from sqlalchemy.orm import Session
from app.db import models
from app.core.notifier import manager
import asyncio

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
        kitchen = db.query(models.Kitchen).filter(models.Kitchen.is_active == True, models.Kitchen.organization_id == session.organization_id).first()
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

        for it in items:
            order_item = models.OrderItem(
                order_id=new_order.id,
                product_name=it["name"],
                quantity=it["qty"]
            )
            db.add(order_item)

        db.commit()

        db.commit()
        db.refresh(new_order)

        # Notify kitchen via WebSockets instantly!
        if session.organization_id:
            import asyncio
            try:
                # We use a helper to fire the notification since this is a sync method
                asyncio.create_task(manager.notify_organization(
                    session.organization_id, 
                    {"type": "new_order", "order_id": new_order.id, "source": "bot"}
                ))
            except Exception:
                # Fallback if no loop is running (e.g. in tests)
                pass

        # Update session tracking
        session.last_interaction_at = models.func.now()
        db.add(session)
        db.commit()

        return True
