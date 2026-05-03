from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.db import models
from app.api.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


# ── Schemas inline ────────────────────────────────────────────────────────────

class PromotionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PromotionOut(BaseModel):
    id: int
    organization_id: int
    title: str
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PromotionOut])
@limiter.limit("120/minute")
def list_promotions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """Listar todas las promociones de la organización."""
    return (
        db.query(models.Promotion)
        .filter(models.Promotion.organization_id == current_user.organization_id)
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
        organization_id=current_user.organization_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
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
            models.Promotion.organization_id == current_user.organization_id,
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
            models.Promotion.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    db.delete(promo)
    db.commit()
