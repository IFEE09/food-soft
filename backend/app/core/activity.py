"""
ActivityLog — escritura asincrónica con buffer + bulk insert.

PROBLEMA QUE RESUELVE:
    Cada acción del usuario genera 1+ ActivityLog. Hacer `db.commit()` síncrono en el
    request bloquea la respuesta y multiplica writes a la DB. Con 100K usuarios activos
    los writes triplican o cuadruplican el load del Postgres.

DISEÑO DURABLE:
    1. `log_activity(...)` ahora encola, no escribe. Retorna inmediato (~µs).
    2. Un worker thread daemon drena la cola y hace bulk insert cada N events o T segundos.
    3. La cola tiene cap (ACTIVITY_LOG_QUEUE_MAX). Si se llena: dropea + warn (preferible
       a bloquear la app entera por logs).
    4. Si la DB falla, el batch se descarta tras log; nunca propagamos excepciones al caller.
    5. `atexit` hace flush final → graceful shutdown sin perder logs.

INVARIANTES (no romper):
    - La firma `log_activity(db, user, action=..., ...)` no cambia. `db` se ignora en async
      mode (mantenido por compat con callers existentes).
    - El módulo es importable sin DB: el worker arranca lazy en el primer log.
    - Falla silenciosa: NUNCA lanzar excepción al caller.

DESACTIVAR (back to sync):
    settings.ACTIVITY_LOG_ASYNC = False   # útil para debugging / tests
"""

from __future__ import annotations

import atexit
import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import models

logger = logging.getLogger(__name__)


# ── Estructura interna del evento (sin acoplar a SQLAlchemy) ────────────────
def _event_dict(
    user: Optional[models.User],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    description: Optional[str],
    organization_id: Optional[int],
) -> dict[str, Any]:
    org_id = organization_id if organization_id is not None else (user.organization_id if user else None)
    return {
        "organization_id": org_id,
        "user_id": user.id if user else None,
        "user_name": (user.full_name if user else None) or (user.email if user else None),
        "user_role": user.role if user else None,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "created_at": datetime.now(timezone.utc),
    }


# ── Writer async con buffer + worker thread ─────────────────────────────────
class _AsyncActivityWriter:
    """Singleton. Lazy-init: worker arranca al primer log_activity."""

    def __init__(self) -> None:
        self._queue: queue.Queue[dict[str, Any]] = queue.Queue(
            maxsize=settings.ACTIVITY_LOG_QUEUE_MAX
        )
        self._stop_event = threading.Event()
        self._worker: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._dropped = 0  # contador de eventos perdidos por queue llena

    def _ensure_worker(self) -> None:
        if self._worker is not None and self._worker.is_alive():
            return
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                return
            self._worker = threading.Thread(
                target=self._run,
                name="activity-log-writer",
                daemon=True,
            )
            self._worker.start()
            atexit.register(self._shutdown)

    def enqueue(self, event: dict[str, Any]) -> None:
        self._ensure_worker()
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            self._dropped += 1
            # No spamear: log cada 100 dropeos.
            if self._dropped % 100 == 1:
                logger.warning(
                    "activity_log_queue_full dropped=%s queue_max=%s",
                    self._dropped, settings.ACTIVITY_LOG_QUEUE_MAX,
                )

    def _run(self) -> None:
        """Drena la cola y hace bulk insert en batches."""
        from app.db.session import SessionLocal

        batch: list[dict[str, Any]] = []
        last_flush = time.monotonic()

        while not self._stop_event.is_set():
            timeout = max(
                0.05,
                settings.ACTIVITY_LOG_FLUSH_INTERVAL - (time.monotonic() - last_flush),
            )
            try:
                event = self._queue.get(timeout=timeout)
                batch.append(event)
            except queue.Empty:
                pass

            now = time.monotonic()
            should_flush = (
                len(batch) >= settings.ACTIVITY_LOG_BATCH_SIZE
                or (batch and (now - last_flush) >= settings.ACTIVITY_LOG_FLUSH_INTERVAL)
            )
            if should_flush:
                self._flush(SessionLocal, batch)
                batch = []
                last_flush = now

        # Stop event: flush final.
        # Drenar lo que quede en la cola sin bloquear.
        try:
            while True:
                batch.append(self._queue.get_nowait())
        except queue.Empty:
            pass
        if batch:
            self._flush(SessionLocal, batch)

    def _flush(self, session_factory: Any, batch: list[dict[str, Any]]) -> None:
        """Bulk insert tolerante a fallas. Si falla, dropea el batch."""
        if not batch:
            return
        db: Optional[Session] = None
        try:
            db = session_factory()
            db.bulk_insert_mappings(models.ActivityLog, batch)
            db.commit()
        except Exception:
            logger.exception("activity_log_flush_failed batch_size=%s", len(batch))
            try:
                if db is not None:
                    db.rollback()
            except Exception:
                pass
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception:
                    pass

    def _shutdown(self) -> None:
        """atexit hook. Da hasta 5s para drenar la cola."""
        self._stop_event.set()
        if self._worker is not None and self._worker.is_alive():
            self._worker.join(timeout=5.0)


_writer = _AsyncActivityWriter()


# ── API pública (firma estable) ──────────────────────────────────────────────
def log_activity(
    db: Session,
    user: Optional[models.User],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    description: Optional[str] = None,
    organization_id: Optional[int] = None,
) -> None:
    """
    Registra una actividad. Async por defecto: encola y retorna inmediato.

    `db` se acepta por compat (se usa solo en modo sync). El worker tiene su propia sesión.
    Nunca lanza excepción.
    """
    try:
        event = _event_dict(user, action, entity_type, entity_id, description, organization_id)
    except Exception:
        logger.exception("activity_log_event_build_failed action=%s entity=%s", action, entity_type)
        return

    if not settings.ACTIVITY_LOG_ASYNC:
        # Modo legacy (sync). Útil en tests o debugging.
        try:
            entry = models.ActivityLog(**event)
            db.add(entry)
            db.commit()
        except Exception:
            logger.exception(
                "activity_log_sync_failed action=%s entity_type=%s entity_id=%s",
                action, entity_type, entity_id,
            )
            try:
                db.rollback()
            except Exception:
                pass
        return

    _writer.enqueue(event)
