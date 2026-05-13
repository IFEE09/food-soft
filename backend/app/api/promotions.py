from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.menu_cache import invalidate_promotions
from app.core.rate_limit import limiter
from app.db import models
from app.db.session import get_db

router = APIRouter()


# ── Schemas inline ────────────────────────────────────────────────────────────

class PromotionCreate(BaseModel):
    title: str
    description: str | None = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_active: bool | None = None


class PromotionOut(BaseModel):
    id: int
    organization_id: int
    title: str
    description: str | None
    is_active: bool

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[PromotionOut])
@limiter.limit("120/minute")
def list_promotions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """Listar todas las promociones de la organización."""
    return (
        db.query(models.Promotion)
        .filter(models.Promotion.organization_id == current_user.active_organization_id)
        .order_by(models.Promotion.created_at.desc())
        .all()
    )


@router.post("/", response_model=PromotionOut, status_code=201)
@limiter.limit("60/minute")
def create_promotion(
    request: Request,
    payload: PromotionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """Crear una nueva promoción."""
    promo = models.Promotion(
        organization_id=current_user.active_organization_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    invalidate_promotions(current_user.active_organization_id)
    return promo


@router.put("/{promo_id}", response_model=PromotionOut)
@limiter.limit("60/minute")
def update_promotion(
    request: Request,
    promo_id: int,
    payload: PromotionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """Actualizar una promoción existente."""
    promo = (
        db.query(models.Promotion)
        .filter(
            models.Promotion.id == promo_id,
            models.Promotion.organization_id == current_user.active_organization_id,
        )
        .first()
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    if payload.title is not None:
        promo.title = payload.title.strip()
    if payload.description is not None:
        promo.description = payload.description.strip()
    if payload.is_active is not None:
        promo.is_active = payload.is_active
    db.commit()
    db.refresh(promo)
    invalidate_promotions(current_user.active_organization_id)
    return promo


@router.delete("/{promo_id}", status_code=204)
@limiter.limit("60/minute")
def delete_promotion(
    request: Request,
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    """Eliminar una promoción."""
    promo = (
        db.query(models.Promotion)
        .filter(
            models.Promotion.id == promo_id,
            models.Promotion.organization_id == current_user.active_organization_id,
        )
        .first()
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    db.delete(promo)
    db.commit()
    invalidate_promotions(current_user.active_organization_id)
