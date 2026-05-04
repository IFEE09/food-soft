from typing import Any, List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.db.session import get_db
from app.db import models
from app.schemas import order as order_schema
from app.api.auth import get_current_user
from app.core.activity import log_activity
from app.core.inventory import deduct_supplies_for_line_items
from app.core.tenant import assert_kitchen_in_organization

router = APIRouter()

@router.get("/", response_model=List[order_schema.Order])
@limiter.limit("180/minute")
def read_orders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    kitchen_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> Any:
    """ Retrieve orders for organization with optional date filters. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.organization_id)
    if status:
        query = query.filter(models.Order.status == status)
    if kitchen_id is not None:
        query = query.filter(models.Order.kitchen_id == kitchen_id)
    if date_from:
        query = query.filter(models.Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(models.Order.created_at <= datetime.combine(date_to, datetime.max.time()))

    orders = query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/export/csv")
@limiter.limit("30/minute")
def export_orders_csv(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
) -> Any:
    """ Export orders as CSV with optional date and status filters. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.organization_id)
    if status:
        query = query.filter(models.Order.status == status)
    if date_from:
        query = query.filter(models.Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(models.Order.created_at <= datetime.combine(date_to, datetime.max.time()))
    orders = query.order_by(models.Order.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["# Pedido", "Nombre", "Productos", "Nota", "Total", "Estatus", "Fecha", "Hora"])
    for o in orders:
        productos = " | ".join(f"{it.product_name} x{it.quantity}" for it in o.items)
        fecha = o.created_at.strftime("%Y-%m-%d") if o.created_at else ""
        hora = o.created_at.strftime("%H:%M") if o.created_at else ""
        writer.writerow([
            f"#{str(o.id).zfill(4)}",
            o.client_name or "",
            productos,
            getattr(o, 'notes', '') or "",
            f"${o.total:.2f}",
            o.status,
            fecha,
            hora,
        ])

    output.seek(0)
    filename = f"pedidos_{date_from or 'todos'}_{date_to or ''}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/summary")
@limiter.limit("60/minute")
def orders_summary(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
) -> Any:
    """ Return daily breakdown of orders for charting. """
    from sqlalchemy import func as sqlfunc
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.organization_id)
    if status:
        query = query.filter(models.Order.status == status)
    if date_from:
        query = query.filter(models.Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(models.Order.created_at <= datetime.combine(date_to, datetime.max.time()))
    orders = query.order_by(models.Order.created_at.asc()).all()

    # Agrupar por día
    from collections import defaultdict
    daily: dict = defaultdict(lambda: {"count": 0, "total": 0.0})
    for o in orders:
        day = o.created_at.strftime("%Y-%m-%d") if o.created_at else "unknown"
        daily[day]["count"] += 1
        daily[day]["total"] += o.total or 0.0

    total_revenue = sum(o.total or 0.0 for o in orders)
    avg_ticket = (total_revenue / len(orders)) if orders else 0.0

    return {
        "total_orders": len(orders),
        "total_revenue": round(total_revenue, 2),
        "avg_ticket": round(avg_ticket, 2),
        "pending": sum(1 for o in orders if o.status == "pending"),
        "ready": sum(1 for o in orders if o.status == "ready"),
        "delivered": sum(1 for o in orders if o.status == "delivered"),
        "daily": [
            {"date": d, "count": v["count"], "total": round(v["total"], 2)}
            for d, v in sorted(daily.items())
        ],
    }


@router.post("/", response_model=order_schema.Order)
@limiter.limit("120/minute")
async def create_order(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    order_in: order_schema.OrderCreate,
) -> Any:
    """ Create new order for organization. """
    assert_kitchen_in_organization(db, order_in.kitchen_id, current_user.organization_id)
    
    if not order_in.items:
        raise HTTPException(status_code=400, detail="La orden debe contener al menos un platillo.")

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

    try:
        deduct_supplies_for_line_items(db, current_user.organization_id, lines)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    db.commit()
    db.refresh(order)
    log_activity(
        db, current_user,
        action="create", entity_type="order", entity_id=order.id,
        description=f"Creó orden #{order.id} para '{order.client_name}' (total: ${order.total})"
    )
    return order

@router.put("/{id}", response_model=order_schema.Order)
@limiter.limit("120/minute")
def update_order(
    request: Request,
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
@limiter.limit("60/minute")
def delete_order(
    request: Request,
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
