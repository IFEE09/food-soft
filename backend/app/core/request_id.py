"""
Request ID middleware — correlación end-to-end.

CADA request recibe un ID único (UUID4 si no viene en header X-Request-ID).
- Se inyecta en `structlog.contextvars` → todo log dentro del request lo lleva.
- Se devuelve al cliente en header `X-Request-ID` → el frontend/Sentry pueden trazarlo.
- Se guarda en `request.state.request_id` para acceso desde endpoints.

USO en logs (sin esfuerzo extra: ya está bound al contextvar):
    log = get_logger(__name__)
    log.info("order_created", order_id=42)
    # Output: {"event": "order_created", "request_id": "abc-...", "order_id": 42, ...}

USO en respuestas:
    request.state.request_id  # ej. para incluir en error response

DURABILIDAD:
- Header X-Request-ID es estándar de facto (Heroku, AWS ALB, k8s ingress lo usan).
- Si el cliente provee uno, lo respetamos (útil para tracing distribuido).
- structlog contextvars → thread-local + asyncio-task-local → no fugas entre requests.
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        from app.core.db_observability import reset_query_count

        rid = request.headers.get(_REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.state.request_id = rid

        # Bind al contextvar para que structlog lo incluya en cada log de este request.
        structlog.contextvars.bind_contextvars(request_id=rid)
        reset_query_count()
        try:
            response = await call_next(request)
        finally:
            # Limpieza: evita fuga al siguiente request del worker.
            structlog.contextvars.clear_contextvars()

        response.headers[_REQUEST_ID_HEADER] = rid
        return response
