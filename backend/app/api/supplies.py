from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from app.db.session import get_db
from app.db import models
from app.schemas import supply as supply_schema
from app.api.auth import get_current_user, require_owner
from app.core.activity import log_activity
from app.core.tenant import get_owned_or_404

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[supply_schema.Supply])
def read_supplies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Retrieve supplies for the user's organization. """
    return db.query(models.Supply)\
             .filter(models.Supply.organization_id == current_user.organization_id)\
             .offset(skip).limit(limit).all()

@router.post("/", response_model=supply_schema.Supply)
def create_supply(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    supply_in: supply_schema.SupplyCreate,
) -> Any:
    """ Create new supply for the user's organization. """
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Tu usuario no tiene una organización asignada. Por favor, contacta a soporte.")
    
    try:
        supply = models.Supply(
            name=supply_in.name,
            quantity=supply_in.quantity,
            unit=supply_in.unit,
            cost=supply_in.cost,
            min_quantity=supply_in.min_quantity,
            category=supply_in.category,
            organization_id=current_user.organization_id
        )
        db.add(supply)
        db.commit()
        db.refresh(supply)
        log_activity(
            db, current_user,
            action="create", entity_type="supply", entity_id=supply.id,
            description=f"Creó insumo '{supply.name}' (cantidad: {supply.quantity} {supply.unit})"
        )
        return supply
    except Exception:
        db.rollback()
        logger.exception("Error creando insumo")
        raise HTTPException(status_code=500, detail="Error interno del servidor al guardar el insumo.")

@router.put("/{id}", response_model=supply_schema.Supply)
def update_supply(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
    supply_in: supply_schema.SupplyUpdate,
) -> Any:
    """ Update a supply. """
    supply = get_owned_or_404(db, models.Supply, id, current_user, "Insumo no encontrado")

    update_data = supply_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(supply, field, update_data[field])

    db.add(supply)
    db.commit()
    db.refresh(supply)
    changed = ", ".join(update_data.keys()) if update_data else "sin cambios"
    log_activity(
        db, current_user,
        action="update", entity_type="supply", entity_id=supply.id,
        description=f"Actualizó insumo '{supply.name}' (campos: {changed})"
    )
    return supply

@router.delete("/{id}", response_model=supply_schema.Supply)
def delete_supply(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
) -> Any:
    """ Delete a supply. """
    supply = get_owned_or_404(db, models.Supply, id, current_user, "Insumo no encontrado")
    deleted_name = supply.name
    deleted_id = supply.id
    db.delete(supply)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="supply", entity_id=deleted_id,
        description=f"Eliminó insumo '{deleted_name}'"
    )
    return supply
