"""
BotEngine — Motor conversacional con IA (DeepSeek) para el bot omnicanal.

FLUJO PRINCIPAL:
  1. Cliente escribe "hola" / "menu" → saludo personalizado + imagen del menú
  2. Cliente pide un producto → DeepSeek lo identifica y agrega al carrito
     - Si DeepSeek no entiende → "Disculpa, no entendí tu pedido, ¿me lo repites?"
     - Si hay ambigüedad de tamaño → pregunta con opciones
  3. Después de agregar → 3 botones:
       ✅ Confirmar pedido
       ✍️ Agregar instrucciones
       ➕ Agregar / quitar productos
  4. Confirmar pedido:
     - Muestra nombre y dirección guardados con botones Sí / No
     - Si Sí → envía pedido a cocina + mensaje final con número y tiempo
     - Si No → pregunta nombre (Confirmar / Cambiar) luego dirección (Confirmar / Cambiar)
  5. Mensaje final: "Gracias {nombre}, enviaremos tu pedido #{id} a {dirección}. Tiempo estimado: 40-45 min 😊"
"""

import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.core.bot.adapters import WhatsAppAdapter, MessengerAdapter, InstagramAdapter
from app.core.bot.orders import OrderService
from app.core.bot.deepseek_client import ask_deepseek

# URL pública de la imagen del menú de Horno 74
MENU_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/RmfrxWhJgBqCqpyQ.jpg"

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_HISTORY = 20  # Máximo de turnos a conservar en historial

# ── IDs de botones interactivos ───────────────────────────────────────────────
BTN_CONFIRM      = "btn_confirm"       # ✅ Confirmar pedido
BTN_ADD_NOTE     = "btn_add_note"      # ✍️ Agregar instrucciones
BTN_ADD_MORE     = "btn_add_more"      # ➕ Agregar / quitar productos
BTN_DATA_YES     = "btn_data_yes"      # Sí (nombre/dirección correctos)
BTN_DATA_NO      = "btn_data_no"       # No (cambiar datos)
BTN_NAME_OK      = "btn_name_ok"       # Confirmar nombre
BTN_NAME_CHANGE  = "btn_name_change"   # Cambiar nombre
BTN_ADDR_OK      = "btn_addr_ok"       # Confirmar dirección
BTN_ADDR_CHANGE  = "btn_addr_change"   # Cambiar dirección


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _format_cart_summary(items_list: list) -> str:
    """Formatea el pedido con números de posición. Incluye nota por ítem si existe."""
    lines = []
    for i, it in enumerate(items_list):
        line = f"{i + 1}. {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
        if it.get("note"):
            line += f" ✎ {it['note']}"
        lines.append(line)
    return "\n".join(lines)


def _clean_text(channel: str, text: str) -> str:
    """Elimina asteriscos de negrita en canales que no los soportan."""
    if channel in ("messenger", "instagram", "facebook"):
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

    @staticmethod
    def _buttons(channel: str, to: str, body_text: str, buttons: list) -> dict:
        """Envía botones interactivos (WhatsApp) o quick-replies (Messenger/Instagram).
        buttons: [{"id": "btn_id", "title": "Texto"}, ...]  — máx 3 para WhatsApp
        """
        body_text = _clean_text(channel, body_text)
        if channel == "whatsapp":
            return WhatsAppAdapter.format_buttons(to, body_text, buttons)
        if channel == "messenger":
            return MessengerAdapter.format_quick_replies(to, body_text, buttons)
        return InstagramAdapter.format_quick_replies(to, body_text, buttons)

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
        cart = dict(session.cart_data)
        history = list(cart.get("history", []))
        history.append({"role": role, "content": content})
        if len(history) > _MAX_HISTORY:
            history = history[-_MAX_HISTORY:]
        cart["history"] = history
        session.cart_data = cart

    # ── Botones de acción post-carrito ────────────────────────────────────────

    @staticmethod
    def _cart_action_buttons(channel: str, sender_id: str, body_text: str) -> dict:
        """Retorna el payload de los 3 botones de acción post-agregado."""
        buttons = [
            {"id": BTN_CONFIRM,  "title": "✅ Confirmar pedido"},
            {"id": BTN_ADD_NOTE, "title": "✍️ Agregar instrucciones"},
            {"id": BTN_ADD_MORE, "title": "➕ Agregar / quitar"},
        ]
        return BotEngine._buttons(channel, sender_id, body_text, buttons)

    # ── Ejecutores de acciones ────────────────────────────────────────────────

    @staticmethod
    def _execute_show_menu(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int,
        greeting: str = None
    ) -> list:
        """Envía saludo (opcional) + imagen del menú."""
        out = []
        if greeting:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, greeting)})
        out.append({"action": "SEND_IMAGE", "payload": BotEngine._image(channel, sender_id, MENU_IMG)})
        out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "Dime qué quieres pedir y con gusto te lo agrego 😊"
        )})
        return out

    @staticmethod
    def _execute_add_to_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, item_id: int,
        item_note: str = None
    ) -> list:
        """Agrega un producto al carrito y muestra los 3 botones de acción."""
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

        clean_note = (item_note or "").strip()[:120] or None

        # Mismo producto + misma nota → incrementar cantidad; si no → nuevo ítem
        existing = next(
            (it for it in items_list
             if it.get("id") == menu_item.id and it.get("note") == clean_note),
            None
        )
        if existing:
            existing["qty"] += 1
        else:
            new_item = {
                "id": menu_item.id,
                "name": menu_item.name,
                "qty": 1,
                "price": _round_price(menu_item.price),
            }
            if clean_note:
                new_item["note"] = clean_note
            items_list.append(new_item)

        cart["items"] = items_list
        cart["total"] = _round_price(sum(it["price"] * it["qty"] for it in items_list))
        session.cart_data = cart
        db.commit()

        nombre_con_nota = menu_item.name
        if clean_note:
            nombre_con_nota += f" (✎ {clean_note})"

        summary = _format_cart_summary(items_list)
        body_text = (
            f"✅ Agregado: {nombre_con_nota}\n\n"
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._cart_action_buttons(channel, sender_id, body_text)}]

    @staticmethod
    def _execute_view_cart(
        channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        """Muestra el carrito con los 3 botones de acción."""
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. ¿Quieres ver el menú para pedir algo? 🍕"
            )}]
        summary = _format_cart_summary(items_list)
        body_text = (
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n"
            f"(Para quitar: escribe 'quita el 1', para cambiar: 'ponme 2 del 3')"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._cart_action_buttons(channel, sender_id, body_text)}]

    @staticmethod
    def _execute_update_quantity(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int, quantity: int
    ) -> list:
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
        body_text = (
            f"{msg_prefix}\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._cart_action_buttons(channel, sender_id, body_text)}]

    @staticmethod
    def _execute_remove_from_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int
    ) -> list:
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
        body_text = (
            f"✅ {item_to_remove['name']} eliminado de tu pedido.\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._cart_action_buttons(channel, sender_id, body_text)}]

    @staticmethod
    def _execute_cancel_order(
        db: Session, channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        cart = dict(session.cart_data)
        cart["items"] = []
        cart["total"] = 0.0
        cart.pop("pending_confirm_step", None)
        cart.pop("awaiting_data_confirm", None)
        session.cart_data = cart
        session.state = "ACTIVO"
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "Pedido cancelado. ¡Cuando quieras volver a pedir, aquí estaremos! 😊"
        )}]

    # ── Flujo de confirmación ─────────────────────────────────────────────────

    @staticmethod
    def _start_confirm_flow(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, customer: models.BotCustomer
    ) -> list:
        """
        Paso 1 del flujo de confirmación:
        Muestra nombre y dirección guardados con botones Sí / No.
        """
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. Dime qué quieres pedir primero 😊"
            )}]

        saved_name    = (customer.saved_name or "").strip()
        saved_address = (customer.saved_address or "").strip()

        summary = _format_cart_summary(items_list)

        if saved_name and saved_address:
            # Tenemos ambos datos → mostrar y preguntar con Sí / No
            body_text = (
                f"📋 Tu pedido:\n{summary}\n\n"
                f"💰 Total: ${cart.get('total', 0.0)}\n\n"
                f"¿Lo enviamos a nombre de *{saved_name}* a *{saved_address}*?"
            )
            buttons = [
                {"id": BTN_DATA_YES, "title": "✅ Sí, confirmar"},
                {"id": BTN_DATA_NO,  "title": "✏️ No, cambiar datos"},
            ]
            cart["pending_confirm_step"] = "awaiting_yes_no"
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
            return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(channel, sender_id, body_text, buttons)}]
        else:
            # No hay datos guardados → ir directo a pedir nombre
            cart["pending_confirm_step"] = "asking_name"
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
            return BotEngine._ask_name(channel, sender_id, customer)

    @staticmethod
    def _ask_name(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
        """Pregunta el nombre con botones Confirmar / Cambiar si ya hay uno guardado."""
        saved_name = (customer.saved_name or "").strip()
        if saved_name:
            body_text = f"¿Tu nombre sigue siendo *{saved_name}*?"
            buttons = [
                {"id": BTN_NAME_OK,     "title": f"✅ Sí, es {saved_name[:15]}"},
                {"id": BTN_NAME_CHANGE, "title": "✏️ Cambiar nombre"},
            ]
            return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(channel, sender_id, body_text, buttons)}]
        else:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¿Cómo te llamas? Escribe tu nombre para el pedido 😊"
            )}]

    @staticmethod
    def _ask_address(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
        """Pregunta la dirección con botones Confirmar / Cambiar si ya hay una guardada."""
        saved_address = (customer.saved_address or "").strip()
        if saved_address:
            body_text = f"¿Enviamos a *{saved_address}*?"
            buttons = [
                {"id": BTN_ADDR_OK,     "title": "✅ Sí, esa dirección"},
                {"id": BTN_ADDR_CHANGE, "title": "✏️ Cambiar dirección"},
            ]
            return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(channel, sender_id, body_text, buttons)}]
        else:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
            )}]

    @staticmethod
    def _finalize_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, customer: models.BotCustomer
    ) -> list:
        """Crea el pedido en BD, guarda nombre/dirección, limpia carrito y envía mensaje final."""
        cart = dict(session.cart_data)
        confirmed_name    = cart.get("customer_name", "").strip() or (customer.saved_name or "").strip()
        confirmed_address = cart.get("address", "").strip() or (customer.saved_address or "").strip()

        # Asegurar que cart tenga los datos correctos antes de crear el pedido
        cart["customer_name"] = confirmed_name
        cart["address"]       = confirmed_address
        cart.pop("pending_confirm_step", None)
        cart.pop("awaiting_data_confirm", None)
        session.cart_data = cart
        db.commit()

        order_id = OrderService.send_to_internal_software(db, customer, session)
        success  = bool(order_id)

        # Guardar nombre y dirección en BotCustomer para futuros pedidos
        if confirmed_name:
            customer.saved_name = confirmed_name
        if confirmed_address:
            customer.saved_address = confirmed_address

        # Limpiar carrito
        cart["items"] = []
        cart["total"] = 0.0
        if order_id and order_id is not True:
            cart["last_order_id"] = order_id
        cart.pop("pending_confirm_step", None)
        session.cart_data = cart
        session.state = "ACTIVO"
        db.commit()

        first_name = confirmed_name.split()[0].capitalize() if confirmed_name else "Cliente"
        order_num  = f"#{order_id}" if (order_id and order_id is not True) else ""

        if success:
            msg = (
                f"¡Gracias {first_name}! 😊 Enviaremos tu pedido {order_num} "
                f"a *{confirmed_address}* en un estimado de 40 a 45 minutos. "
                f"¡Que lo disfrutes! 🍕"
            )
        else:
            msg = "Lo sentimos, tuvimos un problema técnico al procesar tu pedido. Por favor inténtalo de nuevo."

        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]

    # ── Estado del pedido, calificación y quejas ──────────────────────────────

    @staticmethod
    def _execute_check_order_status(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int
    ) -> list:
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
            "pending":   "🔄 Tu pedido está en cocina, siendo preparado. Tiempo estimado: 40-45 minutos.",
            "ready":     "✅ ¡Tu pedido está listo! Ya puede ser entregado.",
            "delivered": "📦 Tu pedido ya fue entregado. ¡Gracias por tu preferencia!",
        }
        msg = status_map.get(order.status, f"Estado de tu pedido: {order.status}")
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]

    @staticmethod
    def _execute_rate_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, rating
    ) -> list:
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
        cart = dict(session.cart_data)
        cart["last_rating"] = rating_int
        session.cart_data = cart
        db.commit()
        emojis    = ["", "😢", "😕", "😐", "😊", "🤩"]
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
        from app.core.activity import log_activity
        from app.core.notifier import schedule_notify_organization
        log_activity(
            db, None,
            action="complaint",
            entity_type="bot_complaint",
            entity_id=customer.id,
            description=f"Queja de cliente ({customer.channel}/{customer.channel_user_id}): {complaint_text[:300]}",
            organization_id=organization_id,
        )
        schedule_notify_organization(
            organization_id,
            {"type": "complaint", "customer_id": customer.id, "channel": customer.channel, "message": complaint_text[:300]},
        )
        db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "Lamentamos mucho lo ocurrido 😟 Hemos notificado a nuestro equipo y nos pondremos en contacto contigo a la brevedad. ¡Gracias por avisarnos!"
        )}]

    # ── Resolución de comandos por número de posición ────────────────────────

    @staticmethod
    def _resolve_position_command(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, user_text: str
    ):
        """Detecta comandos como 'quita el 2', 'ponme 3 del 2', 'cambia el 1 a 2'."""
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))
        if not items_list:
            return None

        txt = user_text.strip().lower()

        # quita el 2 / quitar 2 / elimina el 1
        m = re.match(
            r"^(?:quita(?:r)?|elimina(?:r)?|borra(?:r)?|saca(?:r)?|remueve?)\s+(?:el\s+|la\s+)?(\d+)$",
            txt
        )
        if m:
            pos = int(m.group(1))
            if 1 <= pos <= len(items_list):
                return BotEngine._execute_remove_from_cart(db, channel, sender_id, session, items_list[pos - 1]["id"])
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        # ponme 3 del 2 / pon 2 del 3 / 2 del 1
        m = re.match(r"^(?:pon(?:me)?|dame)\s+(\d+)\s+del\s+(\d+)$", txt)
        if not m:
            m = re.match(r"^(\d+)\s+del\s+(\d+)$", txt)
        if m:
            qty = int(m.group(1))
            pos = int(m.group(2))
            if 1 <= pos <= len(items_list):
                return BotEngine._execute_update_quantity(db, channel, sender_id, session, items_list[pos - 1]["id"], qty)
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        # cambia el 2 a 3
        m = re.match(r"^cambia(?:r)?\s+(?:el\s+|la\s+)?(\d+)\s+a\s+(\d+)$", txt)
        if m:
            pos = int(m.group(1))
            qty = int(m.group(2))
            if 1 <= pos <= len(items_list):
                return BotEngine._execute_update_quantity(db, channel, sender_id, session, items_list[pos - 1]["id"], qty)
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"No tengo un producto {pos} en tu pedido. Tienes {len(items_list)} producto{'s' if len(items_list) > 1 else ''}."
            )}]

        return None

    # ── Punto de entrada principal ────────────────────────────────────────────

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

        org = db.query(models.Organization).filter_by(id=organization_id).first()
        org_name = org.name if org else "Horno 74"

        menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(50).all()
        promotions = db.query(models.Promotion).filter_by(organization_id=organization_id, is_active=True).all()
        cart  = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cart.get("history", []))
        state = session.state or "ACTIVO"

        user_text = (text or "").strip()

        # ── Timeout de inactividad: 20 minutos ───────────────────────────────
        _INACTIVITY_TIMEOUT = timedelta(minutes=20)
        last_interaction = session.last_interaction_at
        if last_interaction is not None:
            if hasattr(last_interaction, "tzinfo") and last_interaction.tzinfo is not None:
                last_interaction = last_interaction.replace(tzinfo=None)
            inactive_states = {"PIDIENDO_NOTA", "PIDIENDO_NOMBRE", "PIDIENDO_DIRECCION", "CONFIRMANDO_PEDIDO", "ACTIVO", "CARRITO_PENDIENTE"}
            if (datetime.utcnow() - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                session.last_interaction_at = datetime.utcnow()
                db.commit()
                cart  = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. ¡Tu pedido fue cancelado automáticamente! 😊 ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out

        session.last_interaction_at = datetime.utcnow()
        db.commit()

        # ── Sin mensaje de texto (audio, imagen, sticker, etc.) ──────────────
        if not user_text and not interactive_id:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Disculpa, no te entiendo 😅 Escribe *menú* para ver nuestros productos."
            )})
            return out

        # ══════════════════════════════════════════════════════════════════════
        # MANEJO DE BOTONES INTERACTIVOS (interactive_id)
        # ══════════════════════════════════════════════════════════════════════
        if interactive_id:
            btn = interactive_id.strip()

            # ── Botones post-carrito ──────────────────────────────────────────
            if btn == BTN_CONFIRM:
                return BotEngine._start_confirm_flow(db, channel, sender_id, session, customer)

            if btn == BTN_ADD_NOTE:
                cart = dict(session.cart_data)
                cart["pending_confirm_step"] = "asking_note"
                session.cart_data = cart
                db.commit()
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "✍️ Escribe las instrucciones especiales para tu pedido (ej: sin cebolla, extra salsa, toca el timbre, etc.):"
                )}]

            if btn == BTN_ADD_MORE:
                session.state = "ACTIVO"
                db.commit()
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¡Claro! ¿Qué más quieres agregar o quitar? 😊\n(Para quitar escribe: 'quita el 1')"
                )}]

            # ── Botones de confirmación de datos (Sí / No) ───────────────────
            if btn == BTN_DATA_YES:
                # Cliente confirmó nombre y dirección guardados → finalizar
                return BotEngine._finalize_order(db, channel, sender_id, session, customer)

            if btn == BTN_DATA_NO:
                # Cliente quiere cambiar datos → ir a preguntar nombre
                cart = dict(session.cart_data)
                cart["pending_confirm_step"] = "asking_name"
                session.cart_data = cart
                db.commit()
                return BotEngine._ask_name(channel, sender_id, customer)

            # ── Botones de nombre ─────────────────────────────────────────────
            if btn == BTN_NAME_OK:
                # Confirmar nombre guardado → pasar a dirección
                cart = dict(session.cart_data)
                cart["customer_name"] = (customer.saved_name or "").strip()
                cart["pending_confirm_step"] = "asking_address"
                session.cart_data = cart
                db.commit()
                return BotEngine._ask_address(channel, sender_id, customer)

            if btn == BTN_NAME_CHANGE:
                cart = dict(session.cart_data)
                cart["pending_confirm_step"] = "typing_name"
                session.cart_data = cart
                db.commit()
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¿Cuál es tu nombre? Escríbelo 😊"
                )}]

            # ── Botones de dirección ──────────────────────────────────────────
            if btn == BTN_ADDR_OK:
                # Confirmar dirección guardada → finalizar
                cart = dict(session.cart_data)
                cart["address"] = (customer.saved_address or "").strip()
                session.cart_data = cart
                db.commit()
                return BotEngine._finalize_order(db, channel, sender_id, session, customer)

            if btn == BTN_ADDR_CHANGE:
                cart = dict(session.cart_data)
                cart["pending_confirm_step"] = "typing_address"
                session.cart_data = cart
                db.commit()
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
                )}]

            # Botón no reconocido → tratar como texto
            user_text = interactive_id

        # ══════════════════════════════════════════════════════════════════════
        # MANEJO DE ESTADOS ESPECIALES (texto libre en estados de flujo)
        # ══════════════════════════════════════════════════════════════════════

        # ── Estado CONFIRMANDO_PEDIDO: pasos intermedios de datos ────────────
        if state == "CONFIRMANDO_PEDIDO":
            cart = dict(session.cart_data)
            step = cart.get("pending_confirm_step", "")

            # Esperando nota/instrucciones especiales
            if step == "asking_note":
                nota = user_text.strip()
                if nota.lower() not in {"no", "ninguna", "nada", "sin nota", "n", "no gracias"}:
                    cart["notes"] = nota[:200]
                else:
                    cart["notes"] = ""
                cart["pending_confirm_step"] = "asking_name"
                session.cart_data = cart
                db.commit()
                return BotEngine._ask_name(channel, sender_id, customer)

            # Esperando nombre escrito
            if step == "typing_name":
                if user_text and len(user_text.strip()) >= 2:
                    cart["customer_name"] = user_text.strip()[:80]
                    cart["pending_confirm_step"] = "asking_address"
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_address(channel, sender_id, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor escribe tu nombre para continuar 😊"
                )}]

            # Esperando dirección escrita
            if step == "typing_address":
                if user_text and len(user_text.strip()) > 5:
                    cart["address"] = user_text.strip()[:_MAX_ADDRESS_LEN]
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor escribe tu dirección de entrega completa 📍"
                )}]

            # Esperando selección nombre (texto libre)
            if step == "asking_name":
                CONFIRM_WORDS = {"sí", "si", "yes", "ok", "dale", "claro", "va", "correcto", "ese mismo", "esa misma"}
                if customer.saved_name and user_text.strip().lower() in CONFIRM_WORDS:
                    cart["customer_name"] = customer.saved_name
                    cart["pending_confirm_step"] = "asking_address"
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_address(channel, sender_id, customer)
                if user_text and len(user_text.strip()) >= 2:
                    cart["customer_name"] = user_text.strip()[:80]
                    cart["pending_confirm_step"] = "asking_address"
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_address(channel, sender_id, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor escribe tu nombre para continuar 😊"
                )}]

            # Esperando selección dirección (texto libre)
            if step == "asking_address":
                CONFIRM_WORDS = {"sí", "si", "yes", "ok", "dale", "claro", "va", "correcto", "esa misma", "la misma"}
                if customer.saved_address and user_text.strip().lower() in CONFIRM_WORDS:
                    cart["address"] = customer.saved_address
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                if user_text and len(user_text.strip()) > 5:
                    cart["address"] = user_text.strip()[:_MAX_ADDRESS_LEN]
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor escribe tu dirección de entrega completa 📍"
                )}]

            # Esperando Sí/No sobre datos guardados (texto libre)
            if step == "awaiting_yes_no":
                YES_WORDS = {"sí", "si", "yes", "ok", "dale", "claro", "va", "correcto", "confirmar", "confirmo", "listo"}
                NO_WORDS  = {"no", "nope", "cambiar", "no quiero", "modificar"}
                txt_lower = user_text.strip().lower()
                if txt_lower in YES_WORDS:
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                if txt_lower in NO_WORDS:
                    cart["pending_confirm_step"] = "asking_name"
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_name(channel, sender_id, customer)
                # No reconocido → repetir pregunta
                saved_name    = (customer.saved_name or "").strip()
                saved_address = (customer.saved_address or "").strip()
                body_text = f"¿Lo enviamos a nombre de *{saved_name}* a *{saved_address}*?"
                buttons = [
                    {"id": BTN_DATA_YES, "title": "✅ Sí, confirmar"},
                    {"id": BTN_DATA_NO,  "title": "✏️ No, cambiar datos"},
                ]
                return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(channel, sender_id, body_text, buttons)}]

            # Cancelaciones explícitas
            CANCELACIONES = {"no", "cancelar", "cancel", "nope", "olvídalo", "olvidalo", "no quiero"}
            if user_text.strip().lower() in CANCELACIONES:
                return BotEngine._execute_cancel_order(db, channel, sender_id, session)

            # Cualquier otro texto en CONFIRMANDO_PEDIDO → volver a ACTIVO
            session.state = "ACTIVO"
            db.commit()
            state = "ACTIVO"

        # ── Estado CARRITO_PENDIENTE ──────────────────────────────────────────
        if state == "CARRITO_PENDIENTE":
            CONTINUAR = {"continuar", "seguir", "sí", "si", "yes", "ok", "dale", "claro", "va", "ese mismo", "el mismo"}
            NUEVO     = {"nuevo", "empezar", "empezar nuevo", "nuevo pedido", "limpiar", "borrar", "eliminar", "no", "nope"}
            txt_lower = user_text.lower()
            if txt_lower in CONTINUAR:
                session.state = "ACTIVO"
                db.commit()
                return BotEngine._execute_view_cart(channel, sender_id, session)
            if txt_lower in NUEVO:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                db.commit()
                return BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
            active_items = cart.get("items", [])
            summary = _format_cart_summary(active_items)
            body = (
                f"No entendí tu respuesta 😅 Tienes este pedido en curso:\n\n"
                f"{summary}\n\n"
                f"💰 Total: ${cart.get('total', 0.0)}\n\n"
                f"Responde *continuar* para seguir con él o *nuevo* para empezar desde cero."
            )
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)})
            return out

        # ── Palabras clave de reinicio / saludo ───────────────────────────────
        RESET_KEYWORDS = {"hola", "menu", "menú", "inicio", "start", "reiniciar", "hi", "buenas", "buenos", "hey"}
        if user_text.lower() in RESET_KEYWORDS:
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

            # Saludo personalizado
            saved_name = (customer.saved_name or "").strip()
            if saved_name:
                first = saved_name.split()[0].capitalize()
                greeting = f"¡Hola {first}! 😊 Un gusto tenerte de vuelta. ¿Qué vas a ordenar hoy?"
            else:
                greeting = f"¡Hola! 😊 Bienvenido a {org_name}. ¿Qué vas a ordenar hoy?"

            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id, greeting=greeting))
            return out

        # ── Palabras clave para confirmar pedido (texto libre) ────────────────
        CONFIRM_KEYWORDS = {"confirmar pedido", "confirmar", "confirmo", "cerrar pedido", "finalizar pedido", "terminar pedido"}
        if user_text.lower() in CONFIRM_KEYWORDS:
            active_items = cart.get("items", [])
            if active_items:
                return BotEngine._start_confirm_flow(db, channel, sender_id, session, customer)
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. Dime qué quieres pedir primero 😊"
            )}]

        # ── Resolver comandos por número de posición ──────────────────────────
        position_result = BotEngine._resolve_position_command(db, channel, sender_id, session, organization_id, user_text)
        if position_result is not None:
            BotEngine._append_history(session, "user", user_text)
            BotEngine._append_history(session, "assistant", "Pedido actualizado.")
            db.commit()
            return position_result

        # ── Resolver variante pendiente (ej: "familiar" tras ¿Grande o Familiar?) ──
        pending_item    = cart.get("pending_variant_base")
        pending_options = cart.get("pending_variant_options", [])
        if pending_item and user_text:
            txt_low = user_text.strip().lower()
            AFFIRMATIVE_VAGUE = {
                "damela", "dámela", "esa", "ese", "dale", "ok", "va", "sí", "si",
                "claro", "bueno", "listo", "perfecto", "sale", "órale", "orale",
                "la quiero", "lo quiero", "quiero esa", "quiero ese",
                "de esa", "de ese", "esa misma", "ese mismo",
            }
            matched_item = None
            for mi in menu_items:
                mi_name_low = mi.name.lower()
                if pending_item.lower() in mi_name_low and txt_low in mi_name_low:
                    matched_item = mi
                    break
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
            if not matched_item and txt_low in AFFIRMATIVE_VAGUE and len(pending_options) == 1:
                opt = pending_options[0]
                for mi in menu_items:
                    if pending_item.lower() in mi.name.lower() and opt in mi.name.lower():
                        matched_item = mi
                        break

            if matched_item:
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
                opts_str = " o ".join(f"*{o.capitalize()}*" for o in pending_options)
                msg = _clean_text(channel, f"¿Cómo la quieres? {opts_str} 😊")
                out_msg = [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", msg)
                db.commit()
                return out_msg
            else:
                c = dict(session.cart_data)
                c.pop("pending_variant_base", None)
                c.pop("pending_variant_options", None)
                session.cart_data = c
                db.commit()
                cart = dict(session.cart_data)

        # ── Llamar a DeepSeek ─────────────────────────────────────────────────
        ai_response = ask_deepseek(
            message=user_text,
            chat_history=history,
            menu_items=menu_items,
            cart=cart,
            state=state,
            org_name=org_name,
            promotions=promotions,
        )

        actions_list = ai_response if isinstance(ai_response, list) else [ai_response]
        logger.info("DeepSeek actions=%s sender=%s channel=%s", actions_list, sender_id, channel)

        ai_reply_parts = []

        for ai_action in actions_list:
            action = ai_action.get("action", "CHAT")

            if action == "SHOW_MENU":
                result = BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
                out.extend(result)
                ai_reply_parts.append("Mostrando menú.")

            elif action == "ADD_TO_CART":
                item_id = ai_action.get("item_id")
                if item_id is None:
                    msg = "Disculpa, no entendí tu pedido 😅 ¿Me lo repites?"
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
                else:
                    item_note = ai_action.get("item_note") or None
                    result = BotEngine._execute_add_to_cart(
                        db, channel, sender_id, session, organization_id, int(item_id),
                        item_note=item_note
                    )
                    out.extend(result)
                    menu_item = db.query(models.MenuItem).filter(
                        models.MenuItem.id == int(item_id),
                        models.MenuItem.organization_id == organization_id
                    ).first()
                    product_name = menu_item.name if menu_item else f"Producto {item_id}"
                    note_suffix  = f" (✎ {item_note})" if item_note else ""
                    ai_reply_parts.append(f"{product_name}{note_suffix} agregado.")

            elif action == "VIEW_CART":
                result = BotEngine._execute_view_cart(channel, sender_id, session)
                out.extend(result)
                ai_reply_parts.append("Mostrando pedido.")

            elif action == "UPDATE_QUANTITY":
                item_id  = ai_action.get("item_id")
                quantity = ai_action.get("quantity")
                if item_id is None or quantity is None:
                    msg = "¿Cuál producto quieres cambiar y a cuántas unidades?"
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
                else:
                    result = BotEngine._execute_update_quantity(db, channel, sender_id, session, int(item_id), int(quantity))
                    out.extend(result)
                    ai_reply_parts.append(f"Cantidad actualizada.")

            elif action == "REMOVE_FROM_CART":
                item_id = ai_action.get("item_id")
                if item_id is None:
                    msg = "No identifiqué cuál producto quieres quitar. ¿Puedes decirme el nombre exacto?"
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
                else:
                    result = BotEngine._execute_remove_from_cart(db, channel, sender_id, session, int(item_id))
                    out.extend(result)
                    ai_reply_parts.append(f"Producto eliminado.")

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
                ai_reply_parts.append(f"Queja registrada.")

            else:  # CHAT
                _fallback = "Disculpa, no entendí tu pedido 😅 ¿Me lo repites?"
                message_text = ai_action.get("message") or _fallback
                if not message_text.strip():
                    message_text = _fallback
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, message_text)})
                ai_reply_parts.append(message_text)

                # Detectar pregunta de variante y guardar base del producto
                msg_lower = message_text.lower()
                is_variant_question = (
                    ("grande" in msg_lower and "familiar" in msg_lower)
                    or "cómo la quieres" in msg_lower
                    or "cómo lo quieres" in msg_lower
                )
                if is_variant_question:
                    KNOWN_VARIANTS = ["grande", "familiar", "chico", "chica", "mediano", "mediana",
                                      "pequeño", "pequeña", "xl", "xxl", "individual"]
                    detected_opts = [v for v in KNOWN_VARIANTS if v in msg_lower]
                    found_base = None
                    for mi in menu_items:
                        base_parts = mi.name.lower()
                        for v in KNOWN_VARIANTS:
                            base_parts = base_parts.replace(v, "").strip()
                        if base_parts and base_parts in msg_lower:
                            if found_base is None or len(base_parts) > len(found_base):
                                found_base = base_parts
                    if not found_base:
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
                else:
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

        # ── Fallback anti-silencio ────────────────────────────────────────────
        if not out:
            fallback = "Disculpa, no entendí tu pedido 😅 ¿Me lo repites?"
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, fallback)})
            ai_reply_parts.append(fallback)

        ai_reply = " | ".join(ai_reply_parts) if ai_reply_parts else "OK"
        BotEngine._append_history(session, "user", user_text)
        BotEngine._append_history(session, "assistant", ai_reply)
        db.commit()

        return out
