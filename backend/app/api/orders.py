import csv
import io
import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.activity import log_activity
from app.core.inventory import deduct_supplies_for_line_items
from app.core.rate_limit import limiter
from app.core.tenant import assert_kitchen_in_organization
from app.db import models
from app.db.session import get_db
from app.schemas import order as order_schema

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=list[order_schema.Order])
@limiter.limit("180/minute")
def read_orders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    kitchen_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Any:
    """ Retrieve orders for organization with optional date filters. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.active_organization_id)
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
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
) -> Any:
    """ Export orders as CSV with optional date and status filters. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.active_organization_id)
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
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
) -> Any:
    """ Return daily breakdown of orders for charting. """
    query = db.query(models.Order).filter(models.Order.organization_id == current_user.active_organization_id)
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
    assert_kitchen_in_organization(db, order_in.kitchen_id, current_user.active_organization_id)

    if not order_in.items:
        raise HTTPException(status_code=400, detail="La orden debe contener al menos un platillo.")

    order = models.Order(
        client_name=order_in.client_name,
        total=order_in.total,
        status=order_in.status,
        kitchen_id=order_in.kitchen_id,
        organization_id=current_user.active_organization_id
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
        deduct_supplies_for_line_items(db, current_user.active_organization_id, lines)
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
              .filter(models.Order.id == id, models.Order.organization_id == current_user.active_organization_id)\
              .first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = order_in.model_dump(exclude_unset=True)
    if "kitchen_id" in update_data and update_data["kitchen_id"] is not None:
        assert_kitchen_in_organization(
            db, update_data["kitchen_id"], current_user.active_organization_id
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

@router.post("/{id}/mark-ready", response_model=order_schema.Order)
@limiter.limit("60/minute")
def mark_order_ready(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    id: int,
) -> Any:
    """
    Marca el pedido como 'ready' y envía WhatsApp al repartidor
    con el número de pedido, monto, nombre y dirección.
    """
    order = db.query(models.Order)\
              .filter(models.Order.id == id, models.Order.organization_id == current_user.active_organization_id)\
              .first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Actualizar estado
    order.status = "ready"
    if not order.ready_at:
        order.ready_at = datetime.now()
    db.add(order)
    db.commit()
    db.refresh(order)

    # Notificar por WebSocket al dashboard
    try:
        from app.core.notifier import schedule_notify_organization
        schedule_notify_organization(
            current_user.active_organization_id,
            {"type": "order_ready", "order_id": order.id}
        )
    except Exception as e:
        logger.warning("No se pudo notificar por WS: %s", e)

    # Enviar WhatsApp al repartidor (cada organización tiene su propio teléfono).
    # Si la org no tiene delivery_phone o whatsapp_phone_number_id configurados,
    # se logea warning pero no falla el flow — el pedido sí se marca como listo.
    try:
        org = db.query(models.Organization)\
                .filter(models.Organization.id == current_user.active_organization_id)\
                .first()
        phone_number_id = org.whatsapp_phone_number_id if org else None
        delivery_phone = (org.delivery_phone or "").strip() if org else ""
        org_name = (org.name if org else "el restaurante").strip()
        if phone_number_id and delivery_phone:
            from app.core.bot.meta_client import send_whatsapp_message
            pedido_num = str(order.id).zfill(4)
            nombre = order.client_name or "Sin nombre"
            direccion = getattr(order, 'delivery_address', None) or "Sin dirección"
            monto = f"${order.total:.2f}" if order.total else "$0.00"
            msg_text = (
                f"\U0001f6f5 *Pedido listo para entrega*\n\n"
                f"\U0001f4cb Pedido #: *{pedido_num}*\n"
                f"\U0001f464 Cliente: *{nombre}*\n"
                f"\U0001f4cd Dirección: {direccion}\n"
                f"\U0001f4b0 Monto: *{monto}*\n\n"
                f"Ya puedes pasar al restaurante *{org_name}* a recoger el pedido. \U0001f354"
            )
            payload = {
                "messaging_product": "whatsapp",
                "to": delivery_phone,
                "type": "text",
                "text": {"body": msg_text}
            }
            ok = send_whatsapp_message(phone_number_id, payload)
            if not ok:
                logger.warning("WhatsApp al repartidor no enviado (order #%s)", order.id)
        else:
            if not phone_number_id:
                logger.warning("Org %s sin whatsapp_phone_number_id configurado.", current_user.active_organization_id)
            if not delivery_phone:
                logger.warning("Org %s sin delivery_phone configurado.", current_user.active_organization_id)
    except Exception as e:
        logger.error("Error enviando WhatsApp al repartidor: %s", e)

    log_activity(
        db, current_user,
        action="update", entity_type="order", entity_id=order.id,
        description=f"Marcó orden #{order.id} como lista (repartidor notificado por WhatsApp)"
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
              .filter(models.Order.id == id, models.Order.organization_id == current_user.active_organization_id)\
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


# ── KDS: actualizar estado individual de un ítem ──────────────────────────────
@router.patch("/items/{item_id}/status", response_model=order_schema.OrderItem)
@limiter.limit("300/minute")
def update_order_item_status(
    request: Request,
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    item_id: int,
    payload: order_schema.OrderItemStatusUpdate,
) -> Any:
    """
    KDS: Actualiza el estado de un ítem individual (pending → in_progress → done).
    Cuando todos los ítems de un pedido están en 'done', el pedido pasa automáticamente
    a 'ready'.
    """
    VALID_STATUSES = {"pending", "in_progress", "done"}
    if payload.item_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"item_status debe ser uno de: {VALID_STATUSES}")

    # Verificar que el ítem pertenece a la organización del usuario
    item = (
        db.query(models.OrderItem)
        .join(models.Order, models.OrderItem.order_id == models.Order.id)
        .filter(
            models.OrderItem.id == item_id,
            models.Order.organization_id == current_user.active_organization_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.item_status = payload.item_status
    db.add(item)
    db.flush()

    # Auto-completar el pedido si todos sus ítems están en 'done'
    order = db.query(models.Order).filter(models.Order.id == item.order_id).first()
    if order and order.status == "pending":
        all_items = db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).all()
        if all(i.item_status == "done" for i in all_items):
            order.status = "ready"
            order.ready_at = datetime.utcnow()
            db.add(order)
            log_activity(
                db, current_user,
                action="update", entity_type="order", entity_id=order.id,
                description=f"Orden #{order.id} marcada como lista automáticamente (todos los ítems completados)"
            )

    db.commit()
    db.refresh(item)
    return item
