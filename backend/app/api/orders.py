from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema
from app.api.auth import get_current_user
from app.core.notifier import manager
from app.core.activity import log_activity

router = APIRouter()

@router.get("/", response_model=List[order_schema.Order])
def read_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status: str = None
) -> Any:
    """ Retrieve orders for organization. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.organization_id)
    if status:
        query = query.filter(models.Order.status == status)
    
    # Sorting by creation date descendently
    orders = query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders

@router.post("/", response_model=order_schema.Order)
async def create_order(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    order_in: order_schema.OrderCreate,
) -> Any:
    """ Create new order for organization. """
    order = models.Order(
        client_name=order_in.client_name,
        total=order_in.total,
        status=order_in.status,
        organization_id=current_user.organization_id
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
    log_activity(
        db, current_user,
        action="create", entity_type="order", entity_id=order.id,
        description=f"Creó orden #{order.id} para '{order.client_name}' (total: ${order.total})"
    )
    return order

@router.put("/{id}", response_model=order_schema.Order)
def update_order(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    id: int,
    order_in: order_schema.OrderUpdate,
) -> Any:
    """ Update an order (e.g., mark as ready). """
    order = db.query(models.Order)\
              .filter(models.Order.id == id, models.Order.organization_id == current_user.organization_id)\
              .first()
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
    changed = ", ".join(update_data.keys()) if update_data else "sin cambios"
    log_activity(
        db, current_user,
        action="update", entity_type="order", entity_id=order.id,
        description=f"Actualizó orden #{order.id} (campos: {changed}, estado: {order.status})"
    )
    return order

@router.delete("/{id}", response_model=order_schema.Order)
def delete_order(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    id: int,
) -> Any:
    """ Delete an order. """
    order = db.query(models.Order)\
              .filter(models.Order.id == id, models.Order.organization_id == current_user.organization_id)\
              .first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Delete items first
    db.query(models.OrderItem).filter(models.OrderItem.order_id == id).delete()

    deleted_id = order.id
    deleted_client = order.client_name
    db.delete(order)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="order", entity_id=deleted_id,
        description=f"Eliminó orden #{deleted_id} de '{deleted_client}'"
    )
    return order
