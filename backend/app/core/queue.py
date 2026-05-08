"""
Queue abstraction — desacoplar callers del backend.

Hoy: BackgroundTasks de FastAPI (in-process, sin infra).
Mañana: Arq + Redis (worker separado, durable, retry, scheduled jobs).

Uso:
    from app.core.queue import enqueue

    @router.post("/webhook")
    async def webhook(request: Request, bg: BackgroundTasks):
        body = await request.body()
        enqueue(bg, process_meta_payload, body)
        return {"ok": True}

Cuando se conecte Redis/Arq:
- swap impl en `_default_backend()`
- callers no cambian

DECISIÓN DURABLE: la firma `enqueue(bg_tasks, callable, *args, **kwargs)` no cambia.
Si añades nuevos backends, mantén esta firma como puerta única.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import BackgroundTasks

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def enqueue(
    bg_tasks: BackgroundTasks,
    func: Callable[..., Any],
    *args: Any,
    **kwargs: Any,
) -> None:
    """Encola un job. Si REDIS_URL está set y Arq disponible, lo usa; sino BackgroundTasks.

    `bg_tasks` siempre se requiere para mantener compatibilidad con el fallback.
    Cuando se migra a Arq el parámetro queda ignorado.
    """
    redis_url = getattr(settings, "REDIS_URL", None)
    if redis_url:
        # TODO(scale): implementar enqueue Arq aquí cuando se provisione Redis.
        # Por ahora cae a BackgroundTasks aunque haya REDIS_URL (no rompe nada).
        log.debug("queue_redis_pending", func=func.__name__)
    bg_tasks.add_task(func, *args, **kwargs)
