from typing import Optional

from sqlalchemy.orm import Session
from app.db import models
from app.core.bot.adapters import WhatsAppAdapter
from app.core.bot.orders import OrderService
import logging

logger = logging.getLogger(__name__)

from sqlalchemy.exc import IntegrityError
# ... (rest of imports)

class BotEngine:
    @staticmethod
    def get_or_create_session(db: Session, org_id: int, channel: str, sender_id: str):
        # 1. Try to find customer
        customer = db.query(models.BotCustomer).filter_by(
            organization_id=org_id,
            channel_user_id=sender_id,
            channel=channel,
        ).first()
        
        if not customer:
            try:
                customer = models.BotCustomer(
                    organization_id=org_id,
                    channel=channel,
                    channel_user_id=sender_id,
                    name="Invitado"
                )
                db.add(customer)
                db.commit() # Atomic commit to lock the record
            except IntegrityError:
                db.rollback()
                # If someone else created it in the meantime, fetch it
                customer = db.query(models.BotCustomer).filter_by(
                    organization_id=org_id,
                    channel_user_id=sender_id,
                    channel=channel,
                ).first()

        # 2. Try to find or create session
        session = db.query(models.BotSession).filter_by(customer_id=customer.id).first()
        if not session:
            try:
                session = models.BotSession(
                    organization_id=org_id,
                    customer_id=customer.id,
                    state="NUEVO_USUARIO",
                    cart_data={"items": [], "total": 0.0}
                )
                db.add(session)
                db.commit()
            except IntegrityError:
                db.rollback()
                session = db.query(models.BotSession).filter_by(customer_id=customer.id).first()

        return customer, session

    @staticmethod
    def process_message(
        db: Session,
        organization_id: int,
        channel: str,
        sender_id: str,
        text: str,
        interactive_id: Optional[str] = None,
    ):
        """
        State Machine engine that decides what to say/do based on the user's current status in the DB.
        Returns a list of hypothetical external payloads we would fire via requests/axios.
        """
        customer, session = BotEngine.get_or_create_session(db, organization_id, channel, sender_id)
        outbound_messages = []

        if text and text.lower() in ["hola", "menu", "reiniciar"]:
            session.state = "VIENDO_MENU"
            session.cart_data = {"items": [], "total": 0.0}
            db.commit()

        # STATE: NUEVO_USUARIO -> send greeting and transition to VIENDO_MENU
        if session.state == "NUEVO_USUARIO" or session.state == "VIENDO_MENU":
            # For this mock, we just generate the menu structure
            menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(5).all()
            
            rows = []
            for item in menu_items:
                rows.append({
                    "id": f"add_item_{item.id}",
                    "title": item.name[:24],
                    "description": f"${item.price}"
                })
            
            if not rows:
                rows = [{"id": "dummy_item", "title": "Platillo Prueba", "description": "$10"}]

            sections = [{"title": "Opciones Principales", "rows": rows}]

            payload = WhatsAppAdapter.format_list(
                to=sender_id,
                header_text="OMNIKOOK BOT",
                body_text="¡Hola! Por favor selecciona un producto para tu pedido.",
                button_text="Ver Catálogo",
                sections=sections
            )
            outbound_messages.append({"action": "SEND_LIST", "payload": payload})
            
            session.state = "ARMANDO_PEDIDO"
            db.commit()

        # STATE: ARMANDO_PEDIDO -> they clicked a menu item
        elif session.state == "ARMANDO_PEDIDO":
            if interactive_id and interactive_id.startswith("add_item_"):
                item_id = int(interactive_id.split("_")[-1])
                menu_item = (
                    db.query(models.MenuItem)
                    .filter(
                        models.MenuItem.id == item_id,
                        models.MenuItem.organization_id == organization_id,
                    )
                    .first()
                )
                if menu_item:
                    cart = dict(session.cart_data) if session.cart_data else {"items": [], "total": 0.0}
                    cart["items"].append({"id": menu_item.id, "name": menu_item.name, "qty": 1, "price": menu_item.price})
                    cart["total"] += menu_item.price
                    
                    session.cart_data = cart
                    session.state = "PIDIENDO_DIRECCION"
                    db.commit()

                    payload = WhatsAppAdapter.format_text(
                        to=sender_id,
                        text=f"Añadí {menu_item.name} a tu orden. ¿A qué dirección lo llevamos? (escribe tu dirección)"
                    )
                    outbound_messages.append({"action": "SEND_TEXT", "payload": payload})

            else:
                payload = WhatsAppAdapter.format_text(to=sender_id, text="Por favor, usa el catálogo arriba.")
                outbound_messages.append({"action": "SEND_TEXT", "payload": payload})

        # STATE: PIDIENDO_DIRECCION -> text received is the address
        elif session.state == "PIDIENDO_DIRECCION":
            cart = dict(session.cart_data) if session.cart_data else {}
            cart["address"] = text
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()

            msg_body = f"Resumen: ${cart.get('total', 0)}\nEnvío a: {text}\n¿Confirmar pedido?"
            buttons = [
                {"id": "btn_confirm_order", "title": "Sí, confirmar"},
                {"id": "btn_cancel_order", "title": "Cancelar"}
            ]
            payload = WhatsAppAdapter.format_buttons(sender_id, msg_body, buttons)
            outbound_messages.append({"action": "SEND_BUTTONS", "payload": payload})

        # STATE: CONFIRMANDO_PEDIDO -> confirm or cancel clicked
        elif session.state == "CONFIRMANDO_PEDIDO":
            if interactive_id == "btn_confirm_order":
                # PHASE 2: Push to Kitchen
                success = OrderService.send_to_internal_software(db, customer, session)
                if success:
                    payload = WhatsAppAdapter.format_text(sender_id, "¡Pedido recibido en cocina! Te avisaremos cuando esté en camino.")
                    session.state = "VIENDO_MENU" # Reset for next time
                    session.cart_data = {"items": [], "total": 0.0}
                    db.commit()
                else:
                    payload = WhatsAppAdapter.format_text(sender_id, "Hubo un error del sistema al procesar.")
                
                outbound_messages.append({"action": "SEND_TEXT", "payload": payload})
                
            elif interactive_id == "btn_cancel_order":
                session.state = "VIENDO_MENU"
                session.cart_data = {"items": [], "total": 0.0}
                db.commit()
                outbound_messages.append({"action": "SEND_TEXT", "payload": WhatsAppAdapter.format_text(sender_id, "Pedido cancelado. ¡Gracias!")})
                
        return outbound_messages
