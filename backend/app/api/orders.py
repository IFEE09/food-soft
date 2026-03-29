from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema

router = APIRouter()

@router.get("/", response_model=List[order_schema.Order])
def read_orders(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = None
) -> Any:
    """ Retrieve orders. Can filter by status. """
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    
    # Sorting by creation date descendently
    orders = query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders

@router.post("/", response_model=order_schema.Order)
def create_order(
    *,
    db: Session = Depends(get_db),
    order_in: order_schema.OrderCreate,
) -> Any:
    """ Create new order. """
    order = models.Order(
        client_name=order_in.client_name,
        total=order_in.total,
        status=order_in.status
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Add items
    for item_in in order_in.items:
        item = models.OrderItem(
            order_id=order.id,
            product_name=item_in.product_name,
            quantity=item_in.quantity
        )
        db.add(item)
    
    db.commit()
    db.refresh(order)
    return order

@router.put("/{id}", response_model=order_schema.Order)
def update_order(
    *,
    db: Session = Depends(get_db),
    id: int,
    order_in: order_schema.OrderUpdate,
) -> Any:
    """ Update an order (e.g., mark as ready). """
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = order_in.model_dump(exclude_unset=True)
    for field in update_data:
        setattr(order, field, update_data[field])
    
    # Special logic for status transitions
    if order.status == "ready" and not order.ready_at:
        order.ready_at = datetime.now()
    elif order.status == "delivered" and not order.delivered_at:
        order.delivered_at = datetime.now()
    
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.delete("/{id}", response_model=order_schema.Order)
def delete_order(
    *,
    db: Session = Depends(get_db),
    id: int,
) -> Any:
    """ Delete an order. """
    order = db.query(models.Order).filter(models.Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Delete items first
    db.query(models.OrderItem).filter(models.OrderItem.order_id == id).delete()
    
    db.delete(order)
    db.commit()
    return order
