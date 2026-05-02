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

        # Build order internally
        # We need a kitchen to assign. Just grab the first active one for simplicity.
        kitchen = db.query(models.Kitchen).filter(
            models.Kitchen.is_active.is_(True),
            models.Kitchen.organization_id == session.organization_id,
        ).first()
        kitchen_id = kitchen.id if kitchen else None

        new_order = models.Order(
            client_name=f"{customer.name or 'Bot User'} ({customer.channel_user_id})",
            status="pending",
            total=cart.get("total", 0.0),
            kitchen_id=kitchen_id,
            organization_id=session.organization_id
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

        deduct_supplies_for_line_items(db, session.organization_id, lines)
        db.commit()
        db.refresh(new_order)

        log_activity(
            db,
            None,
            action="create",
            entity_type="order",
            entity_id=new_order.id,
            description=f"Pedido WhatsApp/bot #{new_order.id} para '{new_order.client_name}' (${new_order.total})",
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

        return True
