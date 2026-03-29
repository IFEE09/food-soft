from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import kitchen as kitchen_schema

router = APIRouter()

@router.get("/", response_model=List[kitchen_schema.Kitchen])
def read_kitchens(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Get all kitchens. """
    return db.query(models.Kitchen).offset(skip).limit(limit).all()

@router.post("/", response_model=kitchen_schema.Kitchen)
def create_kitchen(
    *,
    db: Session = Depends(get_db),
    kitchen_in: kitchen_schema.KitchenCreate,
) -> Any:
    """ Add new kitchen station. """
    kitchen = models.Kitchen(name=kitchen_in.name, is_active=kitchen_in.is_active)
    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    return kitchen

@router.put("/{id}", response_model=kitchen_schema.Kitchen)
def update_kitchen(
    *,
    db: Session = Depends(get_db),
    id: int,
    kitchen_in: kitchen_schema.KitchenUpdate,
) -> Any:
    """ Toggle kitchen status or name. """
    kitchen = db.query(models.Kitchen).filter(models.Kitchen.id == id).first()
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    
    update_data = kitchen_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(kitchen, field, update_data[field])
    
    db.add(kitchen)
    db.commit()
    db.refresh(kitchen)
    return kitchen

@router.delete("/{id}", response_model=kitchen_schema.Kitchen)
def delete_kitchen(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """ Delete a kitchen (station). """
    kitchen = db.query(models.Kitchen).filter(models.Kitchen.id == id).first()
    if not kitchen:
        raise HTTPException(status_code=404, detail="Kitchen not found")
    db.delete(kitchen)
    db.commit()
    return kitchen
