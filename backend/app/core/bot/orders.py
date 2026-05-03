from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import models
from app.core.activity import log_activity
from app.core.inventory import deduct_supplies_for_line_items
from app.core.notifier import schedule_notify_organization


class OrderService:
    @staticmethod
    def send_to_internal_software(db: Session, customer: models.BotCustomer, session: models.BotSession):
        """Converts the bot session cart into an actual restaurant Order"""
        cart = session.cart_data or {}
        items = cart.get("items", [])
        
        if not items:
            return False

        # Get the first active Station for this organization
        station = db.query(models.Station).filter(
            models.Station.is_active.is_(True),
            models.Station.organization_id == session.organization_id,
        ).first()
        station_id = station.id if station else None

        # Build the client name including the bot customer name if available
        client_name = cart.get("customer_name") or customer.name or None
        if client_name:
            display_name = client_name
        else:
            display_name = f"Bot ({customer.channel_user_id})"

        new_order = models.Order(
            client_name=display_name,
            status="pending",
            total=cart.get("total", 0.0),
            station_id=station_id,
            organization_id=session.organization_id,
        )
        db.add(new_order)
        db.flush()

        lines: list[tuple[str, int]] = []
        for it in items:
            name = (it.get("name") or "").strip()
            if not name:
                continue
            qty = int(it.get("qty") or 1)
            db.add(
                models.OrderItem(
                    order_id=new_order.id,
                    product_name=name,
                    quantity=qty,
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
