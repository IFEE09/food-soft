"""
Healthchecks separados (estándar k8s/Railway):
  /health  → liveness:  el proceso está vivo. Nunca toca DB.
  /ready   → readiness: dependencias OK (DB pingeable). Si falla, el orquestador deja de
             enviar tráfico a este pod hasta que se recupere.

No mover lógica de negocio aquí. Estos endpoints deben ser baratos y rápidos.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db

router = APIRouter(tags=["health"])
log = get_logger(__name__)


@router.get("/health", summary="Liveness probe")
def liveness() -> dict[str, str]:
    """Siempre 200 si el proceso responde. NO consulta dependencias."""
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    """200 si la DB está alcanzable; 503 si no."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        log.warning("readiness_db_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    return {"status": "ready"}
