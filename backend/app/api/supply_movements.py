"""Endpoints para movimientos de inventario: recargas, ajustes y consultas."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_roles
from app.core.activity import log_activity
from app.core.rate_limit import limiter
from app.db import models
from app.db.session import get_db
from app.schemas.supply_movement import SupplyMovementCreate, SupplyMovementOut

router = APIRouter()
logger = logging.getLogger(__name__)

# Tanto owner como cook pueden registrar movimientos (recargas)
require_staff = require_roles("owner", "cook")


@router.get("/", response_model=list[SupplyMovementOut])
@limiter.limit("180/minute")
def list_movements(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    supply_id: int | None = None,
    movement_type: str | None = None,
    limit: int = 100,
    skip: int = 0,
) -> Any:
    """Lista movimientos de inventario de la organización, con filtros opcionales."""
    query = db.query(models.SupplyMovement).filter(
        models.SupplyMovement.organization_id == current_user.organization_id
    )
    if supply_id:
        query = query.filter(models.SupplyMovement.supply_id == supply_id)
    if movement_type:
        query = query.filter(models.SupplyMovement.movement_type == movement_type)
    movements = query.order_by(models.SupplyMovement.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for m in movements:
        item = SupplyMovementOut.model_validate(m)
        if m.supply:
            item.supply_name = m.supply.name
            item.supply_unit = m.supply.unit
        if m.user:
            item.user_name = m.user.full_name
        result.append(item)
    return result


@router.post("/restock", response_model=SupplyMovementOut)
@limiter.limit("120/minute")
def restock_supply(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
    data: SupplyMovementCreate,
) -> Any:
    """Registra una entrada de inventario (recarga). Disponible para owner y cook."""
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0.")

    supply = db.query(models.Supply).filter(
        models.Supply.id == data.supply_id,
        models.Supply.organization_id == current_user.organization_id,
    ).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")

    # Sumar al stock
    supply.quantity = round(supply.quantity + data.quantity, 4)
    movement = models.SupplyMovement(
        supply_id=supply.id,
        organization_id=current_user.organization_id,
        movement_type="in",
        quantity=data.quantity,
        notes=data.notes or f"Recarga manual por {current_user.full_name}",
        user_id=current_user.id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(supply)

    log_activity(
        db, current_user,
        action="restock", entity_type="supply", entity_id=supply.id,
        description=f"Recargó '{supply.name}': +{data.quantity} {supply.unit} → total {supply.quantity} {supply.unit}",
    )

    item = SupplyMovementOut.model_validate(movement)
    item.supply_name = supply.name
    item.supply_unit = supply.unit
    item.user_name = current_user.full_name
    return item


@router.post("/adjust", response_model=SupplyMovementOut)
@limiter.limit("60/minute")
def adjust_supply(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff),
    data: SupplyMovementCreate,
) -> Any:
    """Ajuste manual de inventario (corrección). Reemplaza el stock con el valor dado."""
    if data.quantity < 0:
        raise HTTPException(status_code=400, detail="La cantidad no puede ser negativa.")

    supply = db.query(models.Supply).filter(
        models.Supply.id == data.supply_id,
        models.Supply.organization_id == current_user.organization_id,
    ).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")

    old_qty = supply.quantity
    supply.quantity = round(data.quantity, 4)
    movement = models.SupplyMovement(
        supply_id=supply.id,
        organization_id=current_user.organization_id,
        movement_type="adjust",
        quantity=abs(data.quantity - old_qty),
        notes=data.notes or f"Ajuste manual: {old_qty} → {data.quantity} {supply.unit}",
        user_id=current_user.id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    db.refresh(supply)

    log_activity(
        db, current_user,
        action="adjust", entity_type="supply", entity_id=supply.id,
        description=f"Ajustó '{supply.name}': {old_qty} → {data.quantity} {supply.unit}",
    )

    item = SupplyMovementOut.model_validate(movement)
    item.supply_name = supply.name
    item.supply_unit = supply.unit
    item.user_name = current_user.full_name
    return item
