from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.inventory import deduct_supplies_for_line_items
from app.core.notifier import schedule_notify_organization
from app.db import models


class OrderService:
    @staticmethod
    def send_to_internal_software(db: Session, customer: models.BotCustomer, session: models.BotSession):
        """Converts the bot session cart into an actual restaurant Order.

        KDS logic: each OrderItem inherits station_id from its MenuItem.
        """
        cart = session.cart_data or {}
        items = cart.get("items", [])

        if not items:
            return False

        # Build station_id lookup: name → station_id from the MenuItem catalogue
        item_names = [(it.get("name") or "").strip() for it in items if (it.get("name") or "").strip()]
        station_by_name: dict[str, int | None] = {}
        if item_names:
            db_menu = (
                db.query(models.MenuItem.name, models.MenuItem.station_id)
                .filter(
                    models.MenuItem.name.in_(item_names),
                    models.MenuItem.organization_id == session.organization_id,
                )
                .all()
            )
            station_by_name = {row.name: row.station_id for row in db_menu}

        # Order-level station: first active station of the org (fallback)
        default_station = db.query(models.Station).filter(
            models.Station.is_active.is_(True),
            models.Station.organization_id == session.organization_id,
        ).first()
        order_station_id = default_station.id if default_station else None

        # Build client name
        client_name = cart.get("customer_name") or customer.name or None
        display_name = client_name if client_name else f"Bot ({customer.channel_user_id})"

        delivery_address = (cart.get("address") or "").strip() or None
        notes            = (cart.get("notes")   or "").strip() or None

        new_order = models.Order(
            client_name=display_name,
            status="pending",
            total=cart.get("total", 0.0),
            station_id=order_station_id,
            organization_id=session.organization_id,
            delivery_address=delivery_address,
            notes=notes,
        )
        db.add(new_order)
        db.flush()

        lines: list[tuple[str, int]] = []
        for it in items:
            name = (it.get("name") or "").strip()
            if not name:
                continue
            qty = int(it.get("qty") or 1)
            item_note = (it.get("note") or "").strip() or None
            item_station_id = station_by_name.get(name)  # None si no tiene estación asignada
            db.add(
                models.OrderItem(
                    order_id=new_order.id,
                    product_name=name,
                    quantity=qty,
                    note=item_note,
                    station_id=item_station_id,
                    item_status="pending",
                )
            )
            lines.append((name, qty))

        try:
            deduct_supplies_for_line_items(db, session.organization_id, lines)
        except Exception:
            pass  # Don't block order creation if inventory deduction fails

        db.commit()
        db.refresh(new_order)

        log_activity(
            db,
            None,
            action="create",
            entity_type="order",
            entity_id=new_order.id,
            description=f"Pedido bot #{new_order.id} para '{new_order.client_name}' (${new_order.total})",
            organization_id=session.organization_id,
        )

        if session.organization_id:
            schedule_notify_organization(
                session.organization_id,
                {"type": "new_order", "order_id": new_order.id, "source": "bot"},
            )

        # Update session tracking
        session.last_interaction_at = func.now()
        db.add(session)
        db.commit()

        return new_order.id
