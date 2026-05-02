from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import kitchen as kitchen_schema
from app.api.auth import get_current_user, require_owner
from app.core.activity import log_activity
from app.core.tenant import get_owned_or_404

router = APIRouter()

@router.get("/", response_model=List[kitchen_schema.Kitchen])
def read_kitchens(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Get all kitchens for current organization. """
    return db.query(models.Kitchen)\
             .filter(models.Kitchen.organization_id == current_user.organization_id)\
             .offset(skip).limit(limit).all()

@router.post("/", response_model=kitchen_schema.Kitchen)
def create_kitchen(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    kitchen_in: kitchen_schema.KitchenCreate,
) -> Any:
    """ Add new kitchen station for organization. """
    kitchen = models.Kitchen(
        name=kitchen_in.name, 
        is_active=kitchen_in.is_active,
        organization_id=current_user.organization_id
    )
    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    log_activity(
        db, current_user,
        action="create", entity_type="kitchen", entity_id=kitchen.id,
        description=f"Creó cocina '{kitchen.name}'"
    )
    return kitchen

@router.put("/{id}", response_model=kitchen_schema.Kitchen)
def update_kitchen(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
    kitchen_in: kitchen_schema.KitchenUpdate,
) -> Any:
    """ Update kitchen station. """
    kitchen = get_owned_or_404(db, models.Kitchen, id, current_user, "Kitchen not found")

    update_data = kitchen_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(kitchen, field, update_data[field])

    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    changed = ", ".join(update_data.keys()) if update_data else "sin cambios"
    log_activity(
        db, current_user,
        action="update", entity_type="kitchen", entity_id=kitchen.id,
        description=f"Actualizó cocina '{kitchen.name}' (campos: {changed})"
    )
    return kitchen

@router.delete("/{id}", response_model=kitchen_schema.Kitchen)
def delete_kitchen(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
) -> Any:
    """ Delete a kitchen (station). """
    kitchen = get_owned_or_404(db, models.Kitchen, id, current_user, "Kitchen not found")
    deleted_name = kitchen.name
    deleted_id = kitchen.id
    db.delete(kitchen)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="kitchen", entity_id=deleted_id,
        description=f"Eliminó cocina '{deleted_name}'"
    )
    return kitchen
