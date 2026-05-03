from typing import Any, List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.db import models
from app.schemas import kitchen as kitchen_schema
from app.api.auth import get_current_user, require_owner
from app.core.activity import log_activity
from app.core.tenant import get_owned_or_404

router = APIRouter()

@router.get("/", response_model=List[kitchen_schema.Kitchen])
@limiter.limit("180/minute")
def read_kitchens(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Get all physical kitchens (locations) for current organization. """
    return db.query(models.Kitchen)\
             .filter(models.Kitchen.organization_id == current_user.organization_id)\
             .offset(skip).limit(limit).all()

@router.post("/", response_model=kitchen_schema.Kitchen)
@limiter.limit("60/minute")
def create_kitchen(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    kitchen_in: kitchen_schema.KitchenCreate,
) -> Any:
    """ Add new physical kitchen site. """
    kitchen = models.Kitchen(
        name=kitchen_in.name,
        address=kitchen_in.address,
        is_active=kitchen_in.is_active,
        organization_id=current_user.organization_id
    )
    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    log_activity(
        db, current_user,
        action="create", entity_type="kitchen", entity_id=kitchen.id,
        description=f"Registró nueva ubicación física: {kitchen.name}"
    )
    return kitchen

@router.put("/{id}", response_model=kitchen_schema.Kitchen)
@limiter.limit("60/minute")
def update_kitchen(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    id: int,
    kitchen_in: kitchen_schema.KitchenUpdate,
) -> Any:
    """ Update physical kitchen details. """
    kitchen = get_owned_or_404(db, models.Kitchen, id, current_user, "Kitchen not found")

    update_data = kitchen_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(kitchen, field, update_data[field])

    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    log_activity(
        db, current_user,
        action="update", entity_type="kitchen", entity_id=kitchen.id,
        description=f"Actualizó ubicación: {kitchen.name}"
    )
    return kitchen
