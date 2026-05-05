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
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.core.bot.adapters import WhatsAppAdapter, MessengerAdapter, InstagramAdapter
from app.core.bot.orders import OrderService
from app.core.bot.deepseek_client import ask_deepseek

# URLs públicas de las imágenes del menú de Horno 74
MENU_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/RmfrxWhJgBqCqpyQ.jpg"

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_HISTORY = 20  # Máximo de turnos a conservar en historial


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _format_cart_summary(items_list: list) -> str:
    """Formatea el pedido con números de posición (1, 2, 3...)."""
    return "\n".join(
        f"{i + 1}. {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
        for i, it in enumerate(items_list)
    )


def _clean_text(channel: str, text: str) -> str:
    """
    Limpia el texto según el canal:
    - WhatsApp: soporta *negrita*, se deja tal cual.
    - Facebook Messenger / Instagram: no soportan markdown, se eliminan los asteriscos.
    """
    if channel in ("messenger", "instagram", "facebook"):
        import re
        # Quitar asteriscos de negrita (*texto* o **texto**)
        text = re.sub(r"\*+(.*?)\*+", r"\1", text)
    return text


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
        text = _clean_text(channel, text)
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
            {"action": "SEND_IMAGE", "payload": BotEngine._image(channel, sender_id, MENU_IMG)},
            {"action": "SEND_TEXT",  "payload": BotEngine._text(
                channel, sender_id,
                "Dime qué quieres pedir y con gusto te lo agrego a tu pedido 😊"
            )},
        ]
        return out

    @staticmethod
    def _execute_add_to_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, item_id: int
    ) -> list:
        """Agrega un producto al pedido basándose en el ID real del sistema."""
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

        summary = _format_cart_summary(items_list)
        body = (
            f"✅ Agregado: {menu_item.name}\n\n"
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"Para quitar o cambiar un producto escribe su número (ej: *quita el 1*, *ponme 2 del 3*).\n"
            f"¿Deseas agregar algo más o cerramos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_view_cart(
        channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        """Muestra el contenido actual del pedido."""
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. ¿Quieres ver el menú para pedir algo? 🍕"
            )}]
        summary = _format_cart_summary(items_list)
        body = (
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n\n"
            f"Para quitar o cambiar un producto escribe su número (ej: *quita el 1*, *ponme 2 del 3*).\n"
            f"¿Deseas agregar algo más o cerramos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_update_quantity(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int, quantity: int
    ) -> list:
        """Actualiza la cantidad de un producto en el pedido."""
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))

        item = next((it for it in items_list if it.get("id") == item_id), None)
        if not item:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está en tu pedido. ¿Quieres agregarlo?"
            )}]

        if quantity <= 0:
            items_list = [it for it in items_list if it.get("id") != item_id]
            msg_prefix = f"✅ {item['name']} eliminado de tu pedido."
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
                f"{msg_prefix} Tu pedido está vacío. ¿Quieres pedir algo más?"
            )}]

        summary = _format_cart_summary(items_list)
        body = (
            f"{msg_prefix}\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"Para quitar o cambiar un producto escribe su número (ej: *quita el 1*, *ponme 2 del 3*).\n"
            f"¿Deseas agregar algo más o cerramos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_remove_from_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int
    ) -> list:
        """Quita un producto del pedido por ID."""
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))

        item_to_remove = next((it for it in items_list if it.get("id") == item_id), None)
        if not item_to_remove:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está en tu pedido. ¿Quieres ver lo que tienes?"
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
                f"✅ {item_to_remove['name']} eliminado. Tu pedido está vacío. ¿Quieres pedir algo más?"
            )}]

        summary = _format_cart_summary(items_list)
        body = (
            f"✅ {item_to_remove['name']} eliminado de tu pedido.\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}\n\n"
            f"Para quitar o cambiar un producto escribe su número (ej: *quita el 1*, *ponme 2 del 3*).\n"
            f"¿Deseas agregar algo más o cerramos el pedido?"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)}]

    @staticmethod
    def _execute_ask_address(channel: str, sender_id: str, session: models.BotSession, db: Session) -> list:
        cart = dict(session.cart_data)
        if not cart.get("items"):
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. Primero dime qué quieres pedir 😊"
            )}]
        session.state = "PIDIENDO_NOTA"
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "¿Tienes alguna nota especial para tu pedido? (ej: sin cebolla, extra salsa, etc.) Si no tienes ninguna, escribe *no* 😊"
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
                "Tu pedido está vacío. Dime qué quieres pedir."
            )}]

        cart["address"] = address[:_MAX_ADDRESS_LEN]
        session.cart_data = cart
        session.state = "CONFIRMANDO_PEDIDO"
        db.commit()

        summary = _format_cart_summary(items_list)
        customer_name = cart.get("customer_name", "")
        notes = cart.get("notes", "")
        name_line = f"👤 Nombre: {customer_name}\n" if customer_name else ""
        notes_line = f"📝 Nota: {notes}\n" if notes else ""
        body = (
            f"📋 Resumen de tu pedido:\n\n"
            f"{summary}\n\n"
            f"{name_line}"
            f"📍 Dirección: {address}\n"
            f"{notes_line}"
            f"💰 Total: ${cart.get('total', 0.0)}\n\n"
            f"Escribe *confirmar* para hacer tu pedido 🎉\n"
            f"O escribe *agregar* si quieres añadir algo más 😊"
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

    @staticmethod
    def _finalize_order(
        db, channel: str, sender_id: str,
        session, customer
    ) -> list:
        """Procesa la confirmación final del pedido: crea en BD, guarda nombre/dirección, limpia carrito."""
        from app.core.bot.orders import OrderService
        order_id = OrderService.send_to_internal_software(db, customer, session)
        success = bool(order_id)
        cart = dict(session.cart_data)

        # Guardar nombre y dirección en BotCustomer para futuros pedidos
        confirmed_name    = cart.get("customer_name", "").strip()
        confirmed_address = cart.get("address", "").strip()
        if confirmed_name:
            customer.saved_name = confirmed_name
        if confirmed_address:
            customer.saved_address = confirmed_address

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
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]

    # ── Resolución de comandos por número de posición ────────────────────────────────────────────────────────

    @staticmethod
    def _resolve_position_command(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, user_text: str
    ):
        """
        Detecta comandos por número de posición en el pedido:
          - "quita el 2" / "quitar 2" / "elimina el 1" / "borra el 3"
          - "ponme 3 del 2" / "cambia el 1 a 2" / "2 del 1"
        Retorna lista de mensajes si detectó el comando, o None si no aplica.
        """
        import re
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))
        if not items_list:
            return None

        txt = user_text.strip().lower()

        # Patrón: quitar por posición
        # "quita el 2", "quitar 2", "elimina el 1", "borra el 3"
        m = re.match(
            r"^(?:quita(?:r)?|elimina(?:r)?|borra(?:r)?|saca(?:r)?|remueve?)\s+(?:el\s+|la\s+)?(\d+)$",
            txt
        )
        if m:
            pos = int(m.group(1))
            if 1 <= pos <= len(items_list):
                item = items_list[pos - 1]
                return BotEngine._execute_remove_from_cart(
                    db, channel, sender_id, session, item["id"]
                )
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        # Patrón: cambiar cantidad por posición
        # "ponme 3 del 2", "pon 2 del 3", "2 del 1"
        m = re.match(r"^(?:pon(?:me)?|dame)\s+(\d+)\s+del\s+(\d+)$", txt)
        if not m:
            m = re.match(r"^(\d+)\s+del\s+(\d+)$", txt)
        if m:
            qty = int(m.group(1))
            pos = int(m.group(2))
            if 1 <= pos <= len(items_list):
                item = items_list[pos - 1]
                return BotEngine._execute_update_quantity(
                    db, channel, sender_id, session, item["id"], qty
                )
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        # Patrón: "cambia el 2 a 3"
        m = re.match(r"^cambia(?:r)?\s+(?:el\s+|la\s+)?(\d+)\s+a\s+(\d+)$", txt)
        if m:
            pos = int(m.group(1))
            qty = int(m.group(2))
            if 1 <= pos <= len(items_list):
                item = items_list[pos - 1]
                return BotEngine._execute_update_quantity(
                    db, channel, sender_id, session, item["id"], qty
                )
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        return None  # No es un comando por posición

    # ── Punto de entrada principal ─────────────────────────────────────────────────────────────────────────────────

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

        # Cargar menú completo del sistema, carrito, historial y promociones activas
        menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(50).all()
        promotions = db.query(models.Promotion).filter_by(organization_id=organization_id, is_active=True).all()
        cart = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cart.get("history", []))
        state = session.state or "ACTIVO"

        # Normalizar el texto entrante
        user_text = (text or "").strip()

        # ── Palabras clave que reinician el flujo ─────────────────────────────────────────────────
        RESET_KEYWORDS = {"hola", "menu", "menú", "inicio", "start", "reiniciar", "hi", "buenas", "buenos"}
        if user_text.lower() in RESET_KEYWORDS:
            # Si tiene carrito activo con productos, preguntar antes de limpiar
            active_items = cart.get("items", [])
            if active_items and state not in ("CONFIRMANDO_PEDIDO",):
                summary = _format_cart_summary(active_items)
                total   = cart.get("total", 0.0)
                session.state = "CARRITO_PENDIENTE"
                db.commit()
                body = (
                    f"🛒 Tienes un pedido en curso:\n\n"
                    f"{summary}\n\n"
                    f"💰 Total: ${total}\n\n"
                    f"¿Quieres *continuar* con este pedido o *empezar uno nuevo*?"
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)})
                return out
            # Sin carrito activo → mostrar menú directamente
            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
            return out

        # ── Estado especial: carrito pendiente (continuar o nuevo) ────────────────────────────────────
        if state == "CARRITO_PENDIENTE":
            CONTINUAR = {"continuar", "seguir", "sí", "si", "yes", "ok", "dale", "claro", "va", "ese mismo", "el mismo"}
            NUEVO     = {"nuevo", "empezar", "empezar nuevo", "nuevo pedido", "limpiar", "borrar", "eliminar", "no", "nope"}
            txt_lower = user_text.lower()
            if txt_lower in CONTINUAR:
                session.state = "ACTIVO"
                db.commit()
                # Mostrar el carrito actual para que siga desde donde estaba
                return BotEngine._execute_view_cart(channel, sender_id, session)
            if txt_lower in NUEVO:
                # Limpiar carrito y mostrar menú
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                db.commit()
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out
            # Respuesta no reconocida → volver a preguntar
            active_items = cart.get("items", [])
            summary = _format_cart_summary(active_items)
            total   = cart.get("total", 0.0)
            body = (
                f"No entendí tu respuesta 😅 Tienes este pedido en curso:\n\n"
                f"{summary}\n\n"
                f"💰 Total: ${total}\n\n"
                f"Responde *continuar* para seguir con él o *nuevo* para empezar desde cero."
            )
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)})
            return out

        # ── Palabras clave para cerrar pedido (sin pasar por DeepSeek) ──────────────────
        # ── Timeout de inactividad: 20 minutos (se verifica ANTES de procesar estados) ───────────────
        _INACTIVITY_TIMEOUT = timedelta(minutes=20)
        last_interaction = session.last_interaction_at
        if last_interaction is not None:
            if hasattr(last_interaction, 'tzinfo') and last_interaction.tzinfo is not None:
                last_interaction = last_interaction.replace(tzinfo=None)
            now_utc = datetime.utcnow()
            inactive_states = {"PIDIENDO_NOTA", "PIDIENDO_NOMBRE", "PIDIENDO_DIRECCION", "CONFIRMANDO_PEDIDO", "ACTIVO"}
            if (now_utc - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                session.last_interaction_at = datetime.utcnow()
                db.commit()
                cart = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. ¡No te preocupes, tu pedido fue cancelado automáticamente! 😊 ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out

        # Actualizar last_interaction_at en TODOS los caminos desde aquí
        session.last_interaction_at = datetime.utcnow()
        db.commit()

        # ── Sin mensaje (audio, imagen, sticker, etc.) ────────────────────────────────────────────────
        if not user_text:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Disculpa, no te entiendo 😅 ¿Cómo más te puedo ayudar? Escribe *menú* para ver nuestros productos."
            )})
            return out

        CLOSE_KEYWORDS = {"cerrar pedido", "cerrar mi pedido", "terminar pedido", "terminar mi pedido", "finalizar pedido"}
        if user_text.lower() in CLOSE_KEYWORDS:
            return BotEngine._execute_ask_address(channel, sender_id, session, db)

        # ── Estado especial: confirmación final (sin IA) ───────────────────────────────────
        if state == "CONFIRMANDO_PEDIDO":
            # Cancelar oculto: funciona internamente pero no se muestra en el mensaje
            cancelaciones = {"no", "cancelar", "cancel", "nope", "olvídalo", "olvidalo", "no quiero"}
            # Palabras que activan la confirmación final
            CONFIRM_WORDS = {"confirmar", "confirmo", "si", "sí", "yes", "ok", "dale", "claro", "va",
                             "correcto", "listo", "perfecto", "sale", "andale", "ándale", "así está bien"}
            # "agregar" regresa al estado ACTIVO para seguir pidiendo
            AGREGAR_WORDS = {"agregar", "añadir", "agregar más", "añadir más", "quiero más", "agrego"}
            txt_lower = user_text.strip().lower()

            # ── El cliente escribe "confirmar" → mostrar nombre y dirección para confirmación final ──
            if txt_lower in CONFIRM_WORDS and not dict(session.cart_data).get("awaiting_data_confirm"):
                cart = dict(session.cart_data)
                current_name    = cart.get("customer_name", "").strip()
                current_address = cart.get("address", "").strip()
                name_line    = f"*{current_name}*" if current_name else "(sin nombre)"
                address_line = f"*{current_address}*" if current_address else "(sin dirección)"
                msg = (
                    f"¿Confirmamos el pedido a nombre de {name_line} "
                    f"y lo enviamos a {address_line}?\n\n"
                    f"Escribe *sí* para confirmar, o corrígeme el nombre o dirección 😊"
                )
                cart["awaiting_data_confirm"] = True
                session.cart_data = cart
                db.commit()
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                return out

            # ── El cliente escribe "agregar" → regresar a ACTIVO para seguir pidiendo ──────────────
            if txt_lower in AGREGAR_WORDS:
                session.state = "ACTIVO"
                db.commit()
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¡Claro! ¿Qué más quieres agregar? 😊"
                )})
                return out

            # ── Esperando confirmación de nombre/dirección ───────────────────────────────────────────
            cart = dict(session.cart_data)
            if cart.get("awaiting_data_confirm"):
                cart.pop("awaiting_data_confirm", None)

                if txt_lower in cancelaciones:
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._execute_cancel_order(db, channel, sender_id, session)

                if txt_lower in {"si", "sí", "yes", "ok", "dale", "claro", "correcto", "listo",
                                  "perfecto", "sale", "andale", "ándale", "confirmar", "confirmo"}:
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)

                # El cliente escribió algo diferente: puede ser nombre nuevo o dirección nueva
                import re
                has_street_keywords = bool(re.search(
                    r'\b(calle|av|avenida|blvd|boulevard|col|colonia|fracc|fraccionamiento|'
                    r'num|núm|#|\d{2,}|entre|esquina|interior|int|depto|departamento)\b',
                    txt_lower
                ))
                has_digits = bool(re.search(r'\d', user_text))

                if has_street_keywords or has_digits:
                    cart["address"] = user_text.strip()[:_MAX_ADDRESS_LEN]
                else:
                    cart["customer_name"] = user_text.strip()[:80]

                session.cart_data = cart
                db.commit()

                updated_name    = cart.get("customer_name", "").strip()
                updated_address = cart.get("address", "").strip()
                name_line    = f"*{updated_name}*" if updated_name else "(sin nombre)"
                address_line = f"*{updated_address}*" if updated_address else "(sin dirección)"
                cart["awaiting_data_confirm"] = True
                session.cart_data = cart
                db.commit()
                msg = (
                    f"¿Confirmamos el pedido a nombre de {name_line} "
                    f"y lo enviamos a {address_line}?\n\n"
                    f"Escribe *sí* para confirmar, o corrígeme el nombre o dirección 😊"
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                return out

            if txt_lower in cancelaciones:
                return BotEngine._execute_cancel_order(db, channel, sender_id, session)
            # Si escribe otra cosa, volver a ACTIVO para que DeepSeek procese
            session.state = "ACTIVO"
            db.commit()
            state = "ACTIVO"

        # ── Estado especial: esperando nota (sin IA) ─────────────────────────────────────────
        if state == "PIDIENDO_NOTA":
            nota = user_text.strip()
            cart = dict(session.cart_data)
            if nota.lower() not in {"no", "ninguna", "nada", "sin nota", "n", "no gracias"}:
                cart["notes"] = nota[:200]
            else:
                cart["notes"] = ""
            session.cart_data = cart
            session.state = "PIDIENDO_NOMBRE"
            db.commit()
            # Si el cliente ya tiene nombre guardado, preguntar si sigue siendo el mismo
            if customer.saved_name:
                msg = f"¿Seguimos con el nombre {customer.saved_name}? Responde *sí* o escribe tu nombre 😊"
            else:
                msg = "¿Cómo te llamas? Escribe tu nombre para el pedido 😊"
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
            return out

        # ── Estado especial: esperando nombre (sin IA) ───────────────────────────────────────
        if state == "PIDIENDO_NOMBRE":
            if user_text and len(user_text.strip()) >= 2:
                # Verificar si el cliente confirmó su nombre guardado
                CONFIRM_WORDS = {"sí", "si", "yes", "ok", "dale", "claro", "va", "correcto", "ese mismo"}
                if customer.saved_name and user_text.strip().lower() in CONFIRM_WORDS:
                    confirmed_name = customer.saved_name
                else:
                    confirmed_name = user_text.strip()[:80]

                cart = dict(session.cart_data)
                cart["customer_name"] = confirmed_name
                session.cart_data = cart
                session.state = "PIDIENDO_DIRECCION"
                db.commit()

                first = confirmed_name.split()[0].capitalize()
                # Si tiene dirección guardada, preguntar si la usa de nuevo
                if customer.saved_address:
                    msg = (
                        f"Gracias, {first} 😊 ¿Enviamos de nuevo a *{customer.saved_address}*? "
                        f"Responde *sí* o escribe una nueva dirección 📍"
                    )
                else:
                    msg = f"Gracias, {first} 😊 ¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                return out
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor escribe tu nombre para continuar 😊"
            )})
            return out

        # ── Estado especial: esperando dirección (sin IA) ───────────────────────────────────
        if state == "PIDIENDO_DIRECCION":
            CONFIRM_WORDS = {"sí", "si", "yes", "ok", "dale", "claro", "va", "correcto", "esa misma", "la misma"}
            # Si el cliente confirmó la dirección guardada
            if customer.saved_address and user_text.strip().lower() in CONFIRM_WORDS:
                return BotEngine._execute_confirm_order(
                    db, channel, sender_id, session, customer, customer.saved_address
                )
            if user_text and len(user_text.strip()) > 5:
                return BotEngine._execute_confirm_order(db, channel, sender_id, session, customer, user_text.strip())
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor escribe tu dirección de entrega completa para continuar 📍"
            )})
            return out



        # ── Resolver referencias por número de posición (ej: "quita el 2", "ponme 3 del 1") ───────
        position_result = BotEngine._resolve_position_command(db, channel, sender_id, session, organization_id, user_text)
        if position_result is not None:
            BotEngine._append_history(session, "user", user_text)
            BotEngine._append_history(session, "assistant", "Pedido actualizado.")
            db.commit()
            return position_result

        # ── Resolver variante pendiente (ej: cliente responde "familiar" a ¿Grande o Familiar?) ─────────────────────────────────────────────────────────────────────────────────────
        pending_item = cart.get("pending_variant_base")  # ej: "cuatro quesos"
        pending_options = cart.get("pending_variant_options", [])  # ej: ["grande", "familiar"]
        if pending_item and user_text:
            txt_low = user_text.strip().lower()

            # Palabras coloquiales que significan "dámela" / afirmación sin especificar variante
            AFFIRMATIVE_VAGUE = {
                "damela", "dámela", "esa", "ese", "dale", "ok", "va", "sí", "si",
                "claro", "bueno", "listo", "perfecto", "sale", "órale", "orale",
                "la quiero", "lo quiero", "quiero esa", "quiero ese",
                "de esa", "de ese", "esa misma", "ese mismo",
            }

            # Buscar el producto que coincida con base + variante exacta en el nombre
            matched_item = None
            for mi in menu_items:
                mi_name_low = mi.name.lower()
                if pending_item.lower() in mi_name_low and txt_low in mi_name_low:
                    matched_item = mi
                    break

            # Si no hubo match exacto, buscar si el texto contiene alguna de las opciones conocidas
            if not matched_item and pending_options:
                for opt in pending_options:
                    if opt in txt_low:
                        for mi in menu_items:
                            mi_name_low = mi.name.lower()
                            if pending_item.lower() in mi_name_low and opt in mi_name_low:
                                matched_item = mi
                                break
                        if matched_item:
                            break

            # Si el cliente dijo algo vago/afirmativo y hay exactamente una opción disponible, usarla
            if not matched_item and txt_low in AFFIRMATIVE_VAGUE and len(pending_options) == 1:
                opt = pending_options[0]
                for mi in menu_items:
                    mi_name_low = mi.name.lower()
                    if pending_item.lower() in mi_name_low and opt in mi_name_low:
                        matched_item = mi
                        break

            if matched_item:
                # Limpiar la variante pendiente y agregar al carrito
                c = dict(session.cart_data)
                c.pop("pending_variant_base", None)
                c.pop("pending_variant_options", None)
                session.cart_data = c
                db.commit()
                result = BotEngine._execute_add_to_cart(db, channel, sender_id, session, organization_id, matched_item.id)
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", f"{matched_item.name} agregado.")
                db.commit()
                return result
            elif txt_low in AFFIRMATIVE_VAGUE and len(pending_options) > 1:
                # El cliente dijo algo vago pero hay múltiples opciones — volver a preguntar
                opts_str = " o ".join(f"*{o.capitalize()}*" for o in pending_options)
                msg = BotEngine._clean_text(channel, f"¿Cómo la quieres? {opts_str} 😊")
                out_msg = [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", msg)
                db.commit()
                return out_msg
            else:
                # El cliente cambió de tema — limpiar pending_variant_base
                c = dict(session.cart_data)
                c.pop("pending_variant_base", None)
                c.pop("pending_variant_options", None)
                session.cart_data = c
                db.commit()
                cart = dict(session.cart_data)  # Refrescar cart local

        # ── Llamar a DeepSeek con los productos reales del sistema ────────────────────
        ai_response = ask_deepseek(
            message=user_text,
            chat_history=history,
            menu_items=menu_items,
            cart=cart,
            state=state,
            org_name=org_name,
            promotions=promotions,
        )

        # ai_response es una LISTA de acciones (puede contener múltiples ADD_TO_CART, etc.)
        actions_list = ai_response if isinstance(ai_response, list) else [ai_response]
        logger.info("DeepSeek actions=%s sender=%s channel=%s", actions_list, sender_id, channel)

        ai_reply_parts = []

        # ── Ejecutar cada acción de la lista devuelta por DeepSeek ──────────────────────
        for ai_action in actions_list:
            action = ai_action.get("action", "CHAT")

            if action == "SHOW_MENU":
                result = BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
                out.extend(result)
                ai_reply_parts.append("Mostrando menú.")

            elif action == "ADD_TO_CART":
                item_id = ai_action.get("item_id")
                if item_id is None:
                    msg = ai_action.get("message", "No encontré ese producto. ¿Puedes decirme exactamente cuál quieres?")
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
                else:
                    result = BotEngine._execute_add_to_cart(
                        db, channel, sender_id, session, organization_id, int(item_id)
                    )
                    out.extend(result)
                    menu_item = db.query(models.MenuItem).filter(
                        models.MenuItem.id == int(item_id),
                        models.MenuItem.organization_id == organization_id
                    ).first()
                    product_name = menu_item.name if menu_item else f"Producto {item_id}"
                    ai_reply_parts.append(f"{product_name} agregado a tu pedido.")

            elif action == "VIEW_CART":
                result = BotEngine._execute_view_cart(channel, sender_id, session)
                out.extend(result)
                ai_reply_parts.append("Mostrando pedido.")

            elif action == "UPDATE_QUANTITY":
                item_id = ai_action.get("item_id")
                quantity = ai_action.get("quantity")
                if item_id is None or quantity is None:
                    msg = ai_action.get("message", "¿Cuál producto quieres cambiar y a cuántas unidades?")
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
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
                    ai_reply_parts.append(f"Cantidad de {product_name_upd} actualizada a {quantity}.")

            elif action == "REMOVE_FROM_CART":
                item_id = ai_action.get("item_id")
                if item_id is None:
                    msg = ai_action.get("message", "No identifiqué cuál producto quieres quitar. ¿Puedes decirme el nombre exacto?")
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
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
                    ai_reply_parts.append(f"{product_name_rm} eliminado de tu pedido.")

            elif action == "ASK_ADDRESS":
                result = BotEngine._execute_ask_address(channel, sender_id, session, db)
                out.extend(result)
                ai_reply_parts.append("Solicitando dirección de entrega.")

            elif action == "CONFIRM_ORDER":
                address = (ai_action.get("address") or "").strip()
                if address:
                    result = BotEngine._execute_confirm_order(db, channel, sender_id, session, customer, address)
                    out.extend(result)
                    ai_reply_parts.append(f"Confirmando pedido a: {address}")
                else:
                    result = BotEngine._execute_ask_address(channel, sender_id, session, db)
                    out.extend(result)
                    ai_reply_parts.append("Solicitando dirección.")

            elif action == "CANCEL_ORDER":
                result = BotEngine._execute_cancel_order(db, channel, sender_id, session)
                out.extend(result)
                ai_reply_parts.append("Pedido cancelado.")

            elif action == "CHECK_ORDER_STATUS":
                result = BotEngine._execute_check_order_status(db, channel, sender_id, session, organization_id)
                out.extend(result)
                ai_reply_parts.append("Consultando estado del pedido.")

            elif action == "RATE_ORDER":
                rating = ai_action.get("rating")
                result = BotEngine._execute_rate_order(db, channel, sender_id, session, organization_id, rating)
                out.extend(result)
                ai_reply_parts.append(f"Calificación {rating} registrada.")

            elif action == "COMPLAINT":
                complaint_text = ai_action.get("message", "")
                result = BotEngine._execute_complaint(db, channel, sender_id, session, organization_id, customer, complaint_text)
                out.extend(result)
                ai_reply_parts.append(f"Queja registrada: {complaint_text}")

            else:  # CHAT
                _fallback_not_understood = "No te entendí bien 😅 ¿Me puedes decir qué quieres pedir o en qué te puedo ayudar?"
                message_text = ai_action.get("message") or _fallback_not_understood
                # Si el mensaje es muy corto o vacío, usar el fallback
                if not message_text.strip():
                    message_text = _fallback_not_understood
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, message_text)})
                ai_reply_parts.append(message_text)

                # ── Detectar pregunta de variante y guardar base del producto ─────────────────────────────────────────────────────────────────────────────────────
                # Si el mensaje contiene "¿Cómo la quieres?" o variantes de tamaño,
                # buscar qué producto base se está preguntando para resolver en el próximo mensaje
                msg_lower = message_text.lower()
                is_variant_question = (
                    "grande" in msg_lower and "familiar" in msg_lower
                ) or "cómo la quieres" in msg_lower or "cómo lo quieres" in msg_lower
                if is_variant_question:
                    # Detectar las opciones mencionadas en el mensaje (grande, familiar, etc.)
                    KNOWN_VARIANTS = ["grande", "familiar", "chico", "chica", "mediano", "mediana",
                                      "pequeño", "pequeña", "xl", "xxl", "individual"]
                    detected_opts = [v for v in KNOWN_VARIANTS if v in msg_lower]

                    # Buscar qué producto del menú tiene nombre que aparezca en el mensaje de chat
                    found_base = None
                    for mi in menu_items:
                        base_parts = mi.name.lower()
                        for v in KNOWN_VARIANTS:
                            base_parts = base_parts.replace(v, "").strip()
                        if base_parts and base_parts in msg_lower:
                            if found_base is None or len(base_parts) > len(found_base):
                                found_base = base_parts
                    # Si no se encontró base por nombre exacto, buscar en el historial reciente
                    if not found_base:
                        # Buscar en los últimos 4 mensajes del historial qué producto se mencionó
                        recent = history[-4:] if len(history) >= 4 else history
                        for h_msg in reversed(recent):
                            h_text = h_msg.get("content", "").lower() if isinstance(h_msg, dict) else ""
                            for mi in menu_items:
                                base_parts = mi.name.lower()
                                for v in KNOWN_VARIANTS:
                                    base_parts = base_parts.replace(v, "").strip()
                                if base_parts and len(base_parts) > 3 and base_parts in h_text:
                                    if found_base is None or len(base_parts) > len(found_base):
                                        found_base = base_parts
                            if found_base:
                                break

                    if found_base:
                        c = dict(session.cart_data) if isinstance(session.cart_data, dict) else {}
                        c["pending_variant_base"] = found_base
                        if detected_opts:
                            c["pending_variant_options"] = detected_opts
                        session.cart_data = c
                        db.commit()
                        logger.info("pending_variant_base=%s options=%s", found_base, detected_opts)
                else:
                    # Si no es pregunta de variante, limpiar pending_variant_base y options
                    c = dict(session.cart_data) if isinstance(session.cart_data, dict) else {}
                    changed = False
                    if "pending_variant_base" in c:
                        c.pop("pending_variant_base", None)
                        changed = True
                    if "pending_variant_options" in c:
                        c.pop("pending_variant_options", None)
                        changed = True
                    if changed:
                        session.cart_data = c
                        db.commit()

        ai_reply = " | ".join(ai_reply_parts) if ai_reply_parts else "OK"

        # ── Fallback anti-silencio: si no se generó ninguna respuesta, mandar mensaje de no entendido ──────
        if not out:
            fallback = "No te entendí bien 😅 ¿Me puedes decir qué quieres pedir o en qué te puedo ayudar?"
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, fallback)})
            ai_reply = fallback

        # ── Guardar historial ──────────────────────────────────────────────────────────────────────────────────────
        BotEngine._append_history(session, "user", user_text)
        BotEngine._append_history(session, "assistant", ai_reply)
        db.commit()

        return out
