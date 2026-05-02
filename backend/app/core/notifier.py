import asyncio
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def schedule_notify_organization(org_id: int, message: dict[str, Any]) -> None:
    """Notify WebSocket clients from sync code (e.g. bot OrderService in threadpool)."""
    if _main_loop is None or org_id is None:
        return
    asyncio.run_coroutine_threadsafe(
        manager.notify_organization(org_id, message),
        _main_loop,
    )


class ConnectionManager:
    def __init__(self):
        # org_id -> list of websockets
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, org_id: int):
        await websocket.accept()
        if org_id not in self.active_connections:
            self.active_connections[org_id] = []
        self.active_connections[org_id].append(websocket)

    def disconnect(self, websocket: WebSocket, org_id: int):
        if org_id in self.active_connections:
            self.active_connections[org_id].remove(websocket)

    async def notify_organization(self, org_id: int, message: dict[str, Any]):
        if org_id in self.active_connections:
            for connection in self.active_connections[org_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Connection closed?
                    pass

manager = ConnectionManager()
