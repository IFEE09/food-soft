"""
Structured logging — un solo punto de configuración.

Uso:
    from app.core.logging import get_logger
    log = get_logger(__name__)
    log.info("order_created", order_id=42, total=199.0)

Formato:
    LOG_FORMAT=console (dev): texto legible con colores.
    LOG_FORMAT=json (prod):   una línea JSON por evento (apto Datadog/Sentry/Loki).

Niveles vía LOG_LEVEL (DEBUG, INFO, WARNING, ERROR).
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from app.core.config import settings


def _configure_stdlib_logging() -> None:
    """Redirige stdlib logging (uvicorn, sqlalchemy, etc) por structlog."""
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )
    # Silenciar ruido de SQLAlchemy salvo que se pida DEBUG global.
    if level > logging.DEBUG:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def configure_logging() -> None:
    """Idempotente: llamar una vez al arrancar el proceso."""
    _configure_stdlib_logging()

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.LOG_FORMAT == "json":
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
        ),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> Any:
    """Logger estructurado. Pasar `__name__` para trazabilidad."""
    return structlog.get_logger(name)
