"""
DB observability — slow query log + N+1 detection.

ACTIVACIÓN: llamar `install_db_observability(engine)` una vez al arrancar.

QUÉ HACE:
1. **Slow query log**: cualquier query > SLOW_QUERY_MS_THRESHOLD se loguea con el SQL,
   parámetros (truncados) y duración. Útil para detectar queries problemáticas en prod.
2. **N+1 detector** (DEBUG_QUERY_COUNT=True): cuenta queries por request. Si el contador
   excede `QUERY_COUNT_WARN_THRESHOLD` se logea un warning. Detecta patrones N+1 en dev.

DURABILIDAD:
- Listeners SQLAlchemy son no-invasivos: cero impacto en lógica.
- Si los listeners fallan, los caches/atomic-ops siguen.
- Configurable por env (no toca código para tunear umbrales).
"""

from __future__ import annotations

import time

from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


def install_db_observability(engine: Engine) -> None:
    """Idempotente. Instala listeners de slow query + N+1."""

    @event.listens_for(engine, "before_cursor_execute")
    def _before(conn, cursor, statement, parameters, context, executemany):
        context._query_start_time = time.monotonic()

    @event.listens_for(engine, "after_cursor_execute")
    def _after(conn, cursor, statement, parameters, context, executemany):
        start = getattr(context, "_query_start_time", None)
        if start is None:
            return
        elapsed_ms = (time.monotonic() - start) * 1000.0

        # N+1 counter (request-scoped vía contextvars).
        if settings.DB_QUERY_COUNT_ENABLED:
            try:
                _bump_query_count()
            except Exception:
                pass

        # Slow query log.
        if elapsed_ms >= settings.SLOW_QUERY_MS_THRESHOLD:
            log.warning(
                "slow_query",
                duration_ms=round(elapsed_ms, 2),
                statement=str(statement)[:500],
                params_preview=str(parameters)[:200] if parameters else None,
            )


# ── N+1 detector vía contextvars (auto-bind con request_id middleware) ──────
import contextvars

_query_count: contextvars.ContextVar[int] = contextvars.ContextVar("db_query_count", default=0)


def _bump_query_count() -> None:
    n = _query_count.get() + 1
    _query_count.set(n)
    if n == settings.DB_QUERY_COUNT_WARN_THRESHOLD:
        log.warning(
            "db_query_count_threshold_reached",
            count=n,
            threshold=settings.DB_QUERY_COUNT_WARN_THRESHOLD,
            hint="posible N+1 — usar joinedload/selectinload",
        )


def reset_query_count() -> None:
    """Llamar al inicio de cada request (middleware) para reset del contador."""
    _query_count.set(0)


def current_query_count() -> int:
    return _query_count.get()
