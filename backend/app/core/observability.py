"""
Observabilidad — Sentry init centralizado.

No-op si SENTRY_DSN está vacío, así que es seguro llamar siempre.
Capturar excepción manualmente: `capture_exception(e)`.
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

_initialized = False


def init_sentry() -> None:
    """Idempotente. Llamar una vez al arrancar el proceso."""
    global _initialized
    if _initialized:
        return
    if not settings.SENTRY_DSN:
        log.info("sentry_skipped", reason="no SENTRY_DSN")
        _initialized = True
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENV,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,
            integrations=[
                StarletteIntegration(),
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
        )
        log.info("sentry_initialized", env=settings.ENV)
        _initialized = True
    except ImportError:
        log.warning("sentry_sdk_missing", hint="pip install 'sentry-sdk[fastapi]'")


def capture_exception(exc: BaseException, **context: Any) -> None:
    """Reporta excepción a Sentry si está activo. No-op si no."""
    if not _initialized or not settings.SENTRY_DSN:
        return
    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            for key, value in context.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(exc)
    except Exception:
        # Nunca dejes que el reporter mate el proceso.
        log.exception("sentry_capture_failed")
