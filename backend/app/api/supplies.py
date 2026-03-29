from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import supply as supply_schema

router = APIRouter()

@router.get("/", response_model=List[supply_schema.Supply])
def read_supplies(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """ Retrieve supplies. """
    supplies = db.query(models.Supply).offset(skip).limit(limit).all()
    return supplies

@router.post("/", response_model=supply_schema.Supply)
def create_supply(
    *,
    db: Session = Depends(get_db),
    supply_in: supply_schema.SupplyCreate,
) -> Any:
    """ Create new supply. """
    supply = models.Supply(
        name=supply_in.name,
        quantity=supply_in.quantity,
        unit=supply_in.unit,
        min_quantity=supply_in.min_quantity,
        category=supply_in.category
    )
    db.add(supply)
    db.commit()
    db.refresh(supply)
    return supply

@router.put("/{id}", response_model=supply_schema.Supply)
def update_supply(
    *,
    db: Session = Depends(get_db),
    id: int,
    supply_in: supply_schema.SupplyUpdate,
) -> Any:
    """ Update a supply. """
    supply = db.query(models.Supply).filter(models.Supply.id == id).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    update_data = supply_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(supply, field, update_data[field])
    
    db.add(supply)
    db.commit()
    db.refresh(supply)
    return supply

@router.delete("/{id}", response_model=supply_schema.Supply)
def delete_supply(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """ Delete a supply. """
    supply = db.query(models.Supply).filter(models.Supply.id == id).first()
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    db.delete(supply)
    db.commit()
    return supply
