from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema
from app.api.auth import get_current_user
from app.core.activity import log_activity
from app.core.inventory import deduct_supplies_for_line_items
from app.core.tenant import assert_kitchen_in_organization

router = APIRouter()

@router.get("/", response_model=List[order_schema.Order])
def read_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    kitchen_id: Optional[int] = None,
) -> Any:
    """ Retrieve orders for organization. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.organization_id)
    if status:
        query = query.filter(models.Order.status == status)
    if kitchen_id is not None:
        query = query.filter(models.Order.kitchen_id == kitchen_id)

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
    assert_kitchen_in_organization(db, order_in.kitchen_id, current_user.organization_id)

    order = models.Order(
        client_name=order_in.client_name,
        total=order_in.total,
        status=order_in.status,
        kitchen_id=order_in.kitchen_id,
        organization_id=current_user.organization_id
    )
    db.add(order)
    db.flush()

    lines: list[tuple[str, int]] = []
    for item_in in order_in.items:
        db.add(
            models.OrderItem(
                order_id=order.id,
                product_name=item_in.product_name,
                quantity=item_in.quantity,
            )
        )
        lines.append((item_in.product_name, item_in.quantity))

    deduct_supplies_for_line_items(db, current_user.organization_id, lines)
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
    if "kitchen_id" in update_data and update_data["kitchen_id"] is not None:
        assert_kitchen_in_organization(
            db, update_data["kitchen_id"], current_user.organization_id
        )
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
