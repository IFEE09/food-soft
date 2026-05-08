"""
Notifier — entrega de eventos a clientes WebSocket.

DURABILIDAD: la API pública (`manager.connect/disconnect/notify_organization` y
`schedule_notify_organization`) NO cambia entre backends. Los callers no se modifican
cuando se conecta Redis.

Backends:
  - In-memory (default): un proceso, un set de conexiones por org. Suficiente
    para 1 worker uvicorn. Si corres multi-worker SIN Redis, mensajes se pierden
    para los clientes conectados a otros workers.
  - Redis Pub/Sub (cuando REDIS_URL): cada worker se suscribe al canal `ws:org:<id>`.
    `notify_organization` publica al canal; cada worker lo recibe y reenvía a los
    websockets locales. Funciona con N workers/pods.

API estable:
    from app.core.notifier import manager, schedule_notify_organization

    await manager.connect(websocket, org_id)         # tras autenticar
    manager.disconnect(websocket, org_id)             # al cerrar
    await manager.notify_organization(org_id, msg)    # desde async
    schedule_notify_organization(org_id, msg)         # desde sync (threadpool)
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

_main_loop: asyncio.AbstractEventLoop | None = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Llamado en lifespan startup. Necesario para schedule_notify_organization
    cuando se invoca desde código sync corriendo en threadpool."""
    global _main_loop
    _main_loop = loop


def schedule_notify_organization(org_id: int, message: dict[str, Any]) -> None:
    """Notifica desde código síncrono (ej. OrderService en threadpool)."""
    if _main_loop is None or org_id is None:
        return
    try:
        asyncio.run_coroutine_threadsafe(
            manager.notify_organization(org_id, message),
            _main_loop,
        )
    except Exception as exc:
        log.warning("schedule_notify_failed", org_id=org_id, error=str(exc))


class _InMemoryManager:
    """Single-process manager. Mensajes se entregan solo a websockets de este worker."""

    def __init__(self) -> None:
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: int) -> None:
        # El caller debe hacer websocket.accept() antes (auth por primer mensaje).
        self.active_connections.setdefault(org_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, org_id: int) -> None:
        conns = self.active_connections.get(org_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                self.active_connections.pop(org_id, None)

    async def notify_organization(self, org_id: int, message: dict[str, Any]) -> None:
        conns = list(self.active_connections.get(org_id, []))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                # Conexión muerta. Limpieza pasiva: el endpoint la quitará al cerrar.
                pass


class _RedisPubSubManager:
    """Multi-worker manager. Cada worker mantiene websockets locales y un suscriptor
    al canal Redis de cada org viva en este worker."""

    _CHANNEL_FMT = "ws:org:{org_id}"

    def __init__(self, url: str) -> None:
        import redis.asyncio as aioredis

        self._client = aioredis.from_url(url, decode_responses=True)
        self._local: dict[int, list[WebSocket]] = {}
        self._subscribers: dict[int, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, org_id: int) -> None:
        async with self._lock:
            self._local.setdefault(org_id, []).append(websocket)
            if org_id not in self._subscribers:
                self._subscribers[org_id] = asyncio.create_task(self._subscribe(org_id))

    def disconnect(self, websocket: WebSocket, org_id: int) -> None:
        # NOTA: sync por compat con el caller actual; el unsubscribe del canal Redis
        # ocurre solo cuando no quedan conexiones locales (lazy).
        conns = self._local.get(org_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                self._local.pop(org_id, None)
                task = self._subscribers.pop(org_id, None)
                if task:
                    task.cancel()

    async def notify_organization(self, org_id: int, message: dict[str, Any]) -> None:
        """Publica en Redis. Todos los workers (incluido este) reciben y entregan local."""
        try:
            await self._client.publish(
                self._CHANNEL_FMT.format(org_id=org_id),
                json.dumps(message, default=str),
            )
        except Exception as exc:
            log.warning("notify_publish_failed", org_id=org_id, error=str(exc))

    async def _subscribe(self, org_id: int) -> None:
        """Loop que escucha el canal y reenvía a websockets locales del worker."""
        channel = self._CHANNEL_FMT.format(org_id=org_id)
        try:
            pubsub = self._client.pubsub()
            await pubsub.subscribe(channel)
            async for raw in pubsub.listen():
                if raw.get("type") != "message":
                    continue
                try:
                    payload = json.loads(raw["data"])
                except (TypeError, ValueError):
                    continue
                conns = list(self._local.get(org_id, []))
                for ws in conns:
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        pass
        except asyncio.CancelledError:
            return
        except Exception as exc:
            log.warning("notify_subscribe_loop_failed", org_id=org_id, error=str(exc))


def _build_manager():
    if settings.REDIS_URL:
        try:
            mgr = _RedisPubSubManager(settings.REDIS_URL)
            log.info("notifier_backend_redis")
            return mgr
        except Exception as exc:
            log.warning("notifier_redis_init_failed_falling_back", error=str(exc))
    log.info("notifier_backend_inmemory")
    return _InMemoryManager()


manager = _build_manager()
