"""
Rate limiter — slowapi con backend Redis si está disponible, sino in-memory.

Sin Redis: cada worker uvicorn tiene su propio contador. Los límites se multiplican
por el número de workers (ej: 100/min × 4 workers = 400/min reales).
Con Redis: contadores compartidos entre workers/pods. Límites consistentes.

API: `from app.core.rate_limit import limiter` — los decoradores `@limiter.limit("...")`
no cambian.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _build_limiter() -> Limiter:
    storage_uri: str | None = None
    if settings.REDIS_URL:
        # slowapi soporta redis:// nativo via limits.storage.
        storage_uri = settings.REDIS_URL
        log.info("rate_limit_backend_redis")
    else:
        log.info("rate_limit_backend_inmemory")
    return Limiter(key_func=get_remote_address, storage_uri=storage_uri)


limiter = _build_limiter()
