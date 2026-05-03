"""
BotEngine — Motor conversacional con IA (DeepSeek) para el bot omnicanal.

El motor usa DeepSeek para interpretar mensajes en lenguaje natural y
ejecutar acciones estructuradas sobre el sistema de pedidos.

Acciones que DeepSeek puede devolver:
  SHOW_MENU        → Mostrar el menú de productos (imágenes + texto)
  ADD_TO_CART      → Agregar un producto al carrito (basado en IDs del sistema)
  ASK_ADDRESS      → Pedir dirección de entrega
  CONFIRM_ORDER    → Confirmar y enviar pedido a cocina
  CANCEL_ORDER     → Cancelar el pedido actual
  CHAT             → Respuesta de texto libre (preguntas, saludos, etc.)

El flujo es 100% conversacional: no se usan botones interactivos ni listas.
DeepSeek interpreta lenguaje natural y actúa sobre los productos reales del sistema.
El historial de conversación se guarda en BotSession.cart_data["history"].
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.core.bot.adapters import WhatsAppAdapter, MessengerAdapter, InstagramAdapter
from app.core.bot.orders import OrderService
from app.core.bot.deepseek_client import ask_deepseek

# URLs públicas de las imágenes del menú de Horno 74
MENU_IMG_PARA_COMENZAR = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/QdrcigjkETcmnaog.jpg"
MENU_IMG_TRADICIONALES = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/tWAWZQLDXZyWAOcg.jpg"
MENU_IMG_ESPECIALES    = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/ARkxrVWJRlBxsqse.jpg"

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_HISTORY = 20  # Máximo de turnos a conservar en historial


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class BotEngine:

    # ── Helpers de formato ────────────────────────────────────────────────────

    @staticmethod
    def _image(channel: str, to: str, image_url: str) -> dict:
        if channel == "whatsapp":
            return WhatsAppAdapter.format_image(to, image_url)
        if channel == "messenger":
            return MessengerAdapter.format_image(to, image_url)
        return InstagramAdapter.format_image(to, image_url)

    @staticmethod
    def _text(channel: str, to: str, text: str) -> dict:
        if channel == "whatsapp":
            return WhatsAppAdapter.format_text(to, text)
        if channel == "messenger":
            return MessengerAdapter.format_text(to, text)
        return InstagramAdapter.format_text(to, text)

    # ── Gestión de sesión ─────────────────────────────────────────────────────

    @staticmethod
    def get_or_create_session(
        db: Session, org_id: int, channel: str, sender_id: str
    ) -> tuple:
        customer = (
            db.query(models.BotCustomer)
            .filter_by(organization_id=org_id, channel=channel, channel_user_id=sender_id)
            .first()
        )
        if not customer:
            customer = models.BotCustomer(
                organization_id=org_id,
                channel=channel,
                channel_user_id=sender_id,
                name="Invitado",
            )
            db.add(customer)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                customer = (
                    db.query(models.BotCustomer)
                    .filter_by(organization_id=org_id, channel=channel, channel_user_id=sender_id)
                    .first()
                )

        session = db.query(models.BotSession).filter_by(customer_id=customer.id).first()
        if not session:
            session = models.BotSession(
                organization_id=org_id,
                customer_id=customer.id,
                state="ACTIVO",
                cart_data={"items": [], "total": 0.0, "history": []},
            )
            db.add(session)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                session = db.query(models.BotSession).filter_by(customer_id=customer.id).first()

        # Asegurar estructura del cart_data
        if not isinstance(session.cart_data, dict):
            session.cart_data = {"items": [], "total": 0.0, "history": []}
        if "history" not in session.cart_data:
            cart = dict(session.cart_data)
            cart["history"] = []
            session.cart_data = cart

        return customer, session

    # ── Historial de conversación ─────────────────────────────────────────────

    @staticmethod
    def _append_history(session: models.BotSession, role: str, content: str):
        """Agrega un turno al historial de conversación en cart_data."""
        cart = dict(session.cart_data)
        history = list(cart.get("history", []))
        history.append({"role": role, "content": content})
        if len(history) > _MAX_HISTORY:
            history = history[-_MAX_HISTORY:]
        cart["history"] = history
        session.cart_data = cart

    # ── Ejecutores de acciones ────────────────────────────────────────────────

    @staticmethod
    def _execute_show_menu(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int
    ) -> list:
        """Envía las 3 imágenes del menú + texto con los productos del sistema."""
        items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(50).all()
        if not items:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por el momento no tenemos productos disponibles. ¡Vuelve pronto!"
            )}]
        # Solo imágenes visuales — sin botones ni listas interactivas
        out = [
            {"action": "SEND_IMAGE", "payload": BotEngine._image(channel, sender_id, MENU_IMG_PARA_COMENZAR)},
            {"action": "SEND_IMAGE", "payload": BotEngine._image(channel, sender_id, MENU_IMG_TRADICIONALES)},
            {"action": "SEND_IMAGE", "payload": BotEngine._image(channel, sender_id, MENU_IMG_ESPECIALES)},
            {"action": "SEND_TEXT",  "payload": BotEngine._text(
                channel, sender_id,
                "Dime qué quieres pedir y con gusto te lo agrego al carrito 😊"
            )},
        ]
        return out

    @staticmethod
    def _execute_add_to_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, item_id: int
    ) -> list:
        """Agrega un producto al carrito basándose en el ID real del sistema."""
        menu_item = (
            db.query(models.MenuItem)
            .filter(models.MenuItem.id == item_id, models.MenuItem.organization_id == organization_id)
            .first()
        )
        if not menu_item:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está disponible en este momento. ¿Quieres ver el menú?"
            )}]

        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))

        existing = next((it for it in items_list if it.get("id") == menu_item.id), None)
        if existing:
            existing["qty"] += 1
        else:
            items_list.append({
                "id": menu_item.id,
                "name": menu_item.name,
                "qty": 1,
                "price": _round_price(menu_item.price),
            })

        cart["items"] = items_list
        cart["total"] = _round_price(sum(it["price"] * it["qty"] for it in items_list))
        session.cart_data = cart
        db.commit()

        summary = "\n".join(
            f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
            for it in items_list
        )
        body = (
            f"✅ Agregado: {menu_item.name}\n\n"
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"¿Deseas agregar algo más o terminamos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_view_cart(
        channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        """Muestra el contenido actual del carrito."""
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu carrito está vacío. ¿Quieres ver el menú para pedir algo? 🍕"
            )}]
        summary = "\n".join(
            f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
            for it in items_list
        )
        body = (
            f"🛒 Tu carrito ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n\n"
            f"¿Deseas agregar algo más o terminamos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_update_quantity(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int, quantity: int
    ) -> list:
        """Actualiza la cantidad de un producto en el carrito."""
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))

        item = next((it for it in items_list if it.get("id") == item_id), None)
        if not item:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está en tu carrito. ¿Quieres agregarlo?"
            )}]

        if quantity <= 0:
            items_list = [it for it in items_list if it.get("id") != item_id]
            msg_prefix = f"✅ {item['name']} eliminado del carrito."
        else:
            item["qty"] = quantity
            msg_prefix = f"✅ {item['name']} actualizado a {quantity} unidad{'es' if quantity > 1 else ''}."

        cart["items"] = items_list
        cart["total"] = _round_price(sum(it["price"] * it["qty"] for it in items_list))
        session.cart_data = cart
        db.commit()

        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"{msg_prefix} Tu carrito está vacío. ¿Quieres pedir algo más?"
            )}]

        summary = "\n".join(
            f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
            for it in items_list
        )
        body = (
            f"{msg_prefix}\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"¿Deseas agregar algo más o terminamos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_remove_from_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int
    ) -> list:
        """Quita un producto del carrito por ID."""
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))

        item_to_remove = next((it for it in items_list if it.get("id") == item_id), None)
        if not item_to_remove:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está en tu carrito. ¿Quieres ver lo que tienes?"
            )}]

        if item_to_remove["qty"] > 1:
            item_to_remove["qty"] -= 1
        else:
            items_list = [it for it in items_list if it.get("id") != item_id]

        cart["items"] = items_list
        cart["total"] = _round_price(sum(it["price"] * it["qty"] for it in items_list))
        session.cart_data = cart
        db.commit()

        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"✅ {item_to_remove['name']} eliminado. Tu carrito está vacío. ¿Quieres pedir algo más?"
            )}]

        summary = "\n".join(
            f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
            for it in items_list
        )
        body = (
            f"✅ {item_to_remove['name']} eliminado del carrito.\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"¿Deseas agregar algo más o terminamos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_ask_address(channel: str, sender_id: str, session: models.BotSession, db: Session) -> list:
        cart = dict(session.cart_data)
        if not cart.get("items"):
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu carrito está vacío. Primero dime qué quieres pedir 😊"
            )}]
        session.state = "PIDIENDO_DIRECCION"
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
        )}]

    @staticmethod
    def _execute_confirm_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, customer: models.BotCustomer, address: str
    ) -> list:
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            session.state = "ACTIVO"
            db.commit()
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu carrito está vacío. Dime qué quieres pedir."
            )}]

        cart["address"] = address[:_MAX_ADDRESS_LEN]
        session.cart_data = cart
        session.state = "CONFIRMANDO_PEDIDO"
        db.commit()

        summary = "\n".join(
            f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
            for it in items_list
        )
        body = (
            f"📋 Resumen de tu pedido:\n\n"
            f"{summary}\n\n"
            f"📍 Dirección: {address}\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n\n"
            f"¿Confirmo el pedido? Responde *sí* para confirmar o *no* para cancelar."
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_cancel_order(
        db: Session, channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        cart = dict(session.cart_data)
        cart["items"] = []
        cart["total"] = 0.0
        session.cart_data = cart
        session.state = "ACTIVO"
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "Pedido cancelado. ¡Cuando quieras volver a pedir, aquí estaremos! 😊"
        )}]

    # ── Estado del pedido, calificación y quejas ─────────────────────────────────

    @staticmethod
    def _execute_check_order_status(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int
    ) -> list:
        """Consulta el estado del último pedido del cliente en la BD."""
        cart = dict(session.cart_data)
        last_order_id = cart.get("last_order_id")
        if not last_order_id:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "No encontré un pedido reciente tuyo. ¿Quieres hacer uno nuevo? 🍕"
            )}]
        order = db.query(models.Order).filter(
            models.Order.id == last_order_id,
            models.Order.organization_id == organization_id
        ).first()
        if not order:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "No pude encontrar tu pedido. ¿Necesitas ayuda con algo más?"
            )}]
        status_map = {
            "pending": "🔄 Tu pedido está en cocina, siendo preparado. Tiempo estimado: 35-45 minutos.",
            "ready":   "✅ ¡Tu pedido está listo! Ya puede ser entregado.",
            "delivered": "📦 Tu pedido ya fue entregado. ¡Gracias por tu preferencia!",
        }
        msg = status_map.get(order.status, f"Estado de tu pedido: {order.status}")
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]

    @staticmethod
    def _execute_rate_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, rating
    ) -> list:
        """Registra la calificación del cliente en el historial de la sesión."""
        if rating is None:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¿Cuánto nos calificarías del 1 al 5? ⭐"
            )}]
        try:
            rating_int = int(rating)
            if rating_int < 1 or rating_int > 5:
                raise ValueError
        except (ValueError, TypeError):
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor califícanos con un número del 1 al 5 ⭐"
            )}]
        # Guardar calificación en cart_data
        cart = dict(session.cart_data)
        cart["last_rating"] = rating_int
        session.cart_data = cart
        db.commit()
        emojis = ["", "😢", "😕", "😐", "😊", "🤩"]
        responses = [
            "",
            "Lo sentimos mucho. Trabajaremos para mejorar. ¿Qué salió mal?",
            "Gracias por tu honestidad. Tomaremos en cuenta tu opinión.",
            "Gracias por tu calificación. ¡Seguiremos mejorando!",
            "¡Gracias! Nos alegra que hayas disfrutado tu pedido 😊",
            "¡Excelente! ¡Nos encanta saber que todo estuvo perfecto! 🤩🍕",
        ]
        msg = f"{emojis[rating_int]} {responses[rating_int]}"
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]

    @staticmethod
    def _execute_complaint(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int,
        customer: models.BotCustomer, complaint_text: str
    ) -> list:
        """Registra la queja del cliente y notifica al administrador."""
        from app.core.activity import log_activity
        from app.core.notifier import schedule_notify_organization
        # Registrar en el log de actividad para que el admin lo vea
        log_activity(
            db,
            None,
            action="complaint",
            entity_type="bot_complaint",
            entity_id=customer.id,
            description=f"Queja de cliente ({customer.channel}/{customer.channel_user_id}): {complaint_text[:300]}",
            organization_id=organization_id,
        )
        # Notificar en tiempo real al dashboard del restaurante
        schedule_notify_organization(
            organization_id,
            {"type": "complaint", "customer_id": customer.id, "channel": customer.channel, "message": complaint_text[:300]},
        )
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "Lamentamos mucho lo ocurrido 😟 Hemos notificado a nuestro equipo y nos pondremos en contacto contigo a la brevedad. ¡Gracias por avisarnos!"
        )}]

    # ── Punto de entrada principal ────────────────────────────────────────────────────

    @staticmethod
    def process_message(
        db: Session,
        organization_id: int,
        channel: str,
        sender_id: str,
        text: Optional[str] = None,
        interactive_id: Optional[str] = None,
    ) -> list:
        out = []
        customer, session = BotEngine.get_or_create_session(db, organization_id, channel, sender_id)

        # Nombre de la organización
        org = db.query(models.Organization).filter_by(id=organization_id).first()
        org_name = org.name if org else "Horno 74"

        # Cargar menú completo del sistema, carrito e historial
        menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(50).all()
        cart = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cart.get("history", []))
        state = session.state or "ACTIVO"

        # Normalizar el texto entrante
        user_text = (text or "").strip()

        # ── Palabras clave que reinician el flujo ─────────────────────────────
        RESET_KEYWORDS = {"hola", "menu", "menú", "inicio", "start", "reiniciar", "hi", "buenas", "buenos"}
        if user_text.lower() in RESET_KEYWORDS:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¡Hola! Bienvenido a Horno 74 🍕🔥 Soy Kook, tu asistente de pedidos. Aquí te muestro nuestro menú:"
            )})
            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
            return out

        # ── Estado especial: confirmación final (sin IA) ──────────────────────
        if state == "CONFIRMANDO_PEDIDO":
            confirmaciones = {"sí", "si", "confirmar", "confirmo", "yes", "dale", "ok", "va", "claro"}
            cancelaciones  = {"no", "cancelar", "cancel", "nope"}
            if user_text.lower() in confirmaciones:
                order_id = OrderService.send_to_internal_software(db, customer, session)
                success = bool(order_id)
                cart = dict(session.cart_data)
                cart["items"] = []
                cart["total"] = 0.0
                if order_id and order_id is not True:
                    cart["last_order_id"] = order_id
                session.cart_data = cart
                session.state = "ACTIVO"
                db.commit()
                msg = (
                    "¡Pedido confirmado! 🎉 Tu orden está en camino a la cocina. El tiempo estimado de entrega es de 35 a 45 minutos. ¡Gracias por tu pedido en Horno 74!"
                    if success else
                    "Lo sentimos, tuvimos un problema técnico al procesar tu pedido. Por favor inténtalo de nuevo."
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                return out
            if user_text.lower() in cancelaciones:
                return BotEngine._execute_cancel_order(db, channel, sender_id, session)
            # Si escribe otra cosa estando en confirmación, DeepSeek decide
            # (puede ser que quiera cambiar algo del pedido)

        # ── Estado especial: esperando dirección (sin IA) ─────────────────────
        if state == "PIDIENDO_DIRECCION":
            if user_text and len(user_text.strip()) > 5:
                return BotEngine._execute_confirm_order(db, channel, sender_id, session, customer, user_text.strip())
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor escribe tu dirección de entrega completa para continuar 📍"
            )})
            return out

        # ── Sin mensaje (primer contacto) ─────────────────────────────────────
        if not user_text:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¡Hola! Bienvenido a Horno 74 🍕🔥 Soy Kook, tu asistente de pedidos. Aquí te muestro nuestro menú:"
            )})
            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
            return out

        # ── Llamar a DeepSeek con los productos reales del sistema ────────────
        ai_response = ask_deepseek(
            message=user_text,
            chat_history=history,
            menu_items=menu_items,
            cart=cart,
            state=state,
            org_name=org_name,
        )

        action = ai_response.get("action", "CHAT")
        logger.info("DeepSeek action=%s sender=%s channel=%s", action, sender_id, channel)

        # ── Ejecutar la acción devuelta por DeepSeek ──────────────────────────
        if action == "SHOW_MENU":
            result = BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
            out.extend(result)
            ai_reply = "Mostrando menú."

        elif action == "ADD_TO_CART":
            item_id = ai_response.get("item_id")
            if item_id is None:
                msg = ai_response.get("message", "No encontré ese producto. ¿Puedes decirme exactamente cuál quieres?")
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                ai_reply = msg
            else:
                result = BotEngine._execute_add_to_cart(
                    db, channel, sender_id, session, organization_id, int(item_id)
                )
                out.extend(result)
                # Obtener el nombre real del producto para el historial
                menu_item = db.query(models.MenuItem).filter(
                    models.MenuItem.id == int(item_id),
                    models.MenuItem.organization_id == organization_id
                ).first()
                product_name = menu_item.name if menu_item else f"Producto {item_id}"
                ai_reply = f"{product_name} agregado al carrito."

        elif action == "VIEW_CART":
            result = BotEngine._execute_view_cart(channel, sender_id, session)
            out.extend(result)
            ai_reply = "Mostrando carrito."

        elif action == "UPDATE_QUANTITY":
            item_id = ai_response.get("item_id")
            quantity = ai_response.get("quantity")
            if item_id is None or quantity is None:
                msg = ai_response.get("message", "¿Cuál producto quieres cambiar y a cuántas unidades?")
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                ai_reply = msg
            else:
                result = BotEngine._execute_update_quantity(
                    db, channel, sender_id, session, int(item_id), int(quantity)
                )
                out.extend(result)
                menu_item_upd = db.query(models.MenuItem).filter(
                    models.MenuItem.id == int(item_id),
                    models.MenuItem.organization_id == organization_id
                ).first()
                product_name_upd = menu_item_upd.name if menu_item_upd else f"Producto {item_id}"
                ai_reply = f"Cantidad de {product_name_upd} actualizada a {quantity}."

        elif action == "REMOVE_FROM_CART":
            item_id = ai_response.get("item_id")
            if item_id is None:
                msg = ai_response.get("message", "No identifiqué cuál producto quieres quitar. ¿Puedes decirme el nombre exacto?")
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                ai_reply = msg
            else:
                result = BotEngine._execute_remove_from_cart(
                    db, channel, sender_id, session, int(item_id)
                )
                out.extend(result)
                menu_item_rm = db.query(models.MenuItem).filter(
                    models.MenuItem.id == int(item_id),
                    models.MenuItem.organization_id == organization_id
                ).first()
                product_name_rm = menu_item_rm.name if menu_item_rm else f"Producto {item_id}"
                ai_reply = f"{product_name_rm} eliminado del carrito."

        elif action == "ASK_ADDRESS":
            result = BotEngine._execute_ask_address(channel, sender_id, session, db)
            out.extend(result)
            ai_reply = "Solicitando dirección de entrega."

        elif action == "CONFIRM_ORDER":
            address = (ai_response.get("address") or "").strip()
            if address:
                result = BotEngine._execute_confirm_order(db, channel, sender_id, session, customer, address)
                out.extend(result)
                ai_reply = f"Confirmando pedido a: {address}"
            else:
                result = BotEngine._execute_ask_address(channel, sender_id, session, db)
                out.extend(result)
                ai_reply = "Solicitando dirección."

        elif action == "CANCEL_ORDER":
            result = BotEngine._execute_cancel_order(db, channel, sender_id, session)
            out.extend(result)
            ai_reply = "Pedido cancelado."

        elif action == "CHECK_ORDER_STATUS":
            result = BotEngine._execute_check_order_status(db, channel, sender_id, session, organization_id)
            out.extend(result)
            ai_reply = "Consultando estado del pedido."

        elif action == "RATE_ORDER":
            rating = ai_response.get("rating")
            result = BotEngine._execute_rate_order(db, channel, sender_id, session, organization_id, rating)
            out.extend(result)
            ai_reply = f"Calificación {rating} registrada."

        elif action == "COMPLAINT":
            complaint_text = ai_response.get("message", "")
            result = BotEngine._execute_complaint(db, channel, sender_id, session, organization_id, customer, complaint_text)
            out.extend(result)
            ai_reply = f"Queja registrada: {complaint_text}"

        else:  # CHAT
            message_text = ai_response.get("message", "¿En qué más puedo ayudarte?")
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, message_text)})
            ai_reply = message_text

        # ── Guardar historial ─────────────────────────────────────────────────
        BotEngine._append_history(session, "user", user_text)
        BotEngine._append_history(session, "assistant", ai_reply)
        db.commit()

        return out
