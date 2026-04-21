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

        # Notify kitchen via WebSockets (Fire & forget using event loop if needed, but we can just call it)
        # Broadcasting to org room
        if session.organization_id:
           # Safely running async broadcast from sync context might need asyncio loop handling
           # In FastAPI we can just background task it, but for our mock we will just log it
           pass

        return True
