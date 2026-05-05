"""
BotEngine — Motor conversacional con IA (DeepSeek) para el bot omnicanal.

FLUJO PRINCIPAL:
  1. Cliente escribe "hola" / "menu" → saludo personalizado + imagen del menú
  2. Cliente pide un producto → DeepSeek lo identifica y agrega al carrito
     - Si DeepSeek no entiende → "Disculpa, no entendí tu pedido, ¿me lo repites?"
  3. Después de agregar → mensaje de texto con opciones numeradas con emojis:
       1️⃣ Confirmar pedido
       2️⃣ Agregar instrucciones
       3️⃣ Agregar / quitar productos
     El cliente escribe 1, 2 o 3.
     Si escribe algo no reconocido → "Opción no reconocida" + reenvía las opciones.
  4. Confirmar pedido (opción 1):
     - Muestra nombre y dirección guardados:
         1️⃣ Sí, confirmar
         2️⃣ No, cambiar datos
     - Si 1 → envía pedido a cocina + mensaje final
     - Si 2 → pregunta nombre:
         1️⃣ Confirmar  2️⃣ Cambiar
       luego dirección:
         1️⃣ Confirmar  2️⃣ Cambiar
  5. Mensaje final: "Gracias {nombre}, enviaremos tu pedido #{id} a {dirección}. Estimado: 40-45 min 😊"
  6. El pedido llega al Dashboard General y Panel de Cocinas vía WebSocket (schedule_notify_organization).
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

# URL pública de la imagen del menú
MENU_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/RmfrxWhJgBqCqpyQ.jpg"

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_HISTORY = 20

# ── Estados del flujo de confirmación (guardados en cart["confirm_step"]) ─────
STEP_CART_OPTIONS    = "cart_options"      # Esperando 1/2/3 post-carrito
STEP_AWAITING_YES_NO = "awaiting_yes_no"   # Esperando 1/2 sobre nombre+dirección guardados
STEP_ASKING_NAME     = "asking_name"       # Esperando 1/2 sobre nombre guardado
STEP_TYPING_NAME     = "typing_name"       # Esperando texto libre del nombre
STEP_ASKING_ADDRESS  = "asking_address"    # Esperando 1/2 sobre dirección guardada
STEP_TYPING_ADDRESS  = "typing_address"    # Esperando texto libre de la dirección
STEP_ASKING_NOTE     = "asking_note"       # Esperando texto libre de instrucciones


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _format_cart_summary(items_list: list) -> str:
    lines = []
    for i, it in enumerate(items_list):
        line = f"{i + 1}. {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
        if it.get("note"):
            line += f" ✎ {it['note']}"
        lines.append(line)
    return "\n".join(lines)


def _clean_text(channel: str, text: str) -> str:
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

    # ── Mensajes de opciones numeradas (sin botones interactivos) ─────────────

    @staticmethod
    def _cart_options_msg(channel: str, to: str, cart_body: str) -> dict:
        """Mensaje post-carrito con 3 opciones numeradas con emojis."""
        text = (
            f"{cart_body}\n\n"
            f"¿Qué deseas hacer?\n"
            f"1️⃣ Confirmar pedido\n"
            f"2️⃣ Agregar instrucciones\n"
            f"3️⃣ Agregar / quitar productos"
        )
        return BotEngine._text(channel, to, text)

    @staticmethod
    def _yes_no_msg(channel: str, to: str, body: str) -> dict:
        """Mensaje con opciones Sí / No numeradas."""
        text = f"{body}\n\n1️⃣ Sí, confirmar\n2️⃣ No, cambiar datos"
        return BotEngine._text(channel, to, text)

    @staticmethod
    def _name_confirm_msg(channel: str, to: str, saved_name: str) -> dict:
        text = (
            f"¿Tu nombre sigue siendo *{saved_name}*?\n\n"
            f"1️⃣ Sí, ese es mi nombre\n"
            f"2️⃣ Cambiar nombre"
        )
        return BotEngine._text(channel, to, text)

    @staticmethod
    def _address_confirm_msg(channel: str, to: str, saved_address: str) -> dict:
        text = (
            f"¿Enviamos a *{saved_address}*?\n\n"
            f"1️⃣ Sí, esa dirección\n"
            f"2️⃣ Cambiar dirección"
        )
        return BotEngine._text(channel, to, text)

    @staticmethod
    def _unrecognized_option(channel: str, to: str, options_text: str) -> list:
        """Responde 'Opción no reconocida' y reenvía las opciones."""
        msg = f"⚠️ Opción no reconocida. Por favor elige una de las siguientes:\n\n{options_text}"
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, to, msg)}]

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

        if not isinstance(session.cart_data, dict):
            session.cart_data = {"items": [], "total": 0.0, "history": []}
        if "history" not in session.cart_data:
            cart = dict(session.cart_data)
            cart["history"] = []
            session.cart_data = cart

        return customer, session

    # ── Historial ─────────────────────────────────────────────────────────────

    @staticmethod
    def _append_history(session: models.BotSession, role: str, content: str):
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
        session: models.BotSession, organization_id: int,
        greeting: str = None
    ) -> list:
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
        # Marcar que estamos esperando la elección post-carrito
        cart["confirm_step"] = STEP_CART_OPTIONS
        session.cart_data = cart
        session.state = "CONFIRMANDO_PEDIDO"
        db.commit()

        nombre_con_nota = menu_item.name
        if clean_note:
            nombre_con_nota += f" (✎ {clean_note})"

        summary = _format_cart_summary(items_list)
        cart_body = (
            f"✅ Agregado: {nombre_con_nota}\n\n"
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)}]

    @staticmethod
    def _execute_view_cart(
        channel: str, sender_id: str, session: models.BotSession, db: Session = None
    ) -> list:
        cart = dict(session.cart_data)
        items_list = cart.get("items", [])
        if not items_list:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu pedido está vacío. ¿Quieres ver el menú para pedir algo? 🍕"
            )}]
        summary = _format_cart_summary(items_list)
        cart_body = (
            f"🛒 Tu pedido ({len(items_list)} producto{'s' if len(items_list) > 1 else ''}):\n"
            f"{summary}\n\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n"
            f"(Para quitar: escribe 'quita el 1', para cambiar: 'ponme 2 del 3')"
        )
        if db:
            cart["confirm_step"] = STEP_CART_OPTIONS
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
        return [{"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)}]

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
        cart["confirm_step"] = STEP_CART_OPTIONS
        session.cart_data = cart
        session.state = "CONFIRMANDO_PEDIDO"
        db.commit()

        if not items_list:
            session.state = "ACTIVO"
            db.commit()
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"{msg_prefix} Tu pedido está vacío. ¿Quieres pedir algo más?"
            )}]

        summary = _format_cart_summary(items_list)
        cart_body = (
            f"{msg_prefix}\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)}]

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

        if not items_list:
            session.state = "ACTIVO"
            cart.pop("confirm_step", None)
            session.cart_data = cart
            db.commit()
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                f"✅ {item_to_remove['name']} eliminado. Tu pedido está vacío. ¿Quieres pedir algo más?"
            )}]

        cart["confirm_step"] = STEP_CART_OPTIONS
        session.cart_data = cart
        session.state = "CONFIRMANDO_PEDIDO"
        db.commit()

        summary = _format_cart_summary(items_list)
        cart_body = (
            f"✅ {item_to_remove['name']} eliminado de tu pedido.\n\n"
            f"🛒 Tu pedido actualizado:\n{summary}\n\n"
            f"💰 Total: ${cart['total']}"
        )
        return [{"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)}]

    @staticmethod
    def _execute_cancel_order(
        db: Session, channel: str, sender_id: str, session: models.BotSession
    ) -> list:
        cart = dict(session.cart_data)
        cart["items"] = []
        cart["total"] = 0.0
        cart.pop("confirm_step", None)
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
        """Paso 1: mostrar nombre+dirección guardados con opciones 1️⃣/2️⃣."""
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
            body = (
                f"📋 Tu pedido:\n{summary}\n\n"
                f"💰 Total: ${cart.get('total', 0.0)}\n\n"
                f"¿Lo enviamos a nombre de *{saved_name}* a *{saved_address}*?"
            )
            cart["confirm_step"] = STEP_AWAITING_YES_NO
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
            return [{"action": "SEND_TEXT", "payload": BotEngine._yes_no_msg(channel, sender_id, body)}]
        else:
            # Sin datos → pedir nombre primero
            cart["confirm_step"] = STEP_ASKING_NAME
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
            return BotEngine._ask_name_msg(channel, sender_id, customer)

    @staticmethod
    def _ask_name_msg(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
        saved_name = (customer.saved_name or "").strip()
        if saved_name:
            return [{"action": "SEND_TEXT", "payload": BotEngine._name_confirm_msg(channel, sender_id, saved_name)}]
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "¿Cómo te llamas? Escribe tu nombre para el pedido 😊"
        )}]

    @staticmethod
    def _ask_address_msg(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
        saved_address = (customer.saved_address or "").strip()
        if saved_address:
            return [{"action": "SEND_TEXT", "payload": BotEngine._address_confirm_msg(channel, sender_id, saved_address)}]
        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
        )}]

    @staticmethod
    def _finalize_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, customer: models.BotCustomer
    ) -> list:
        """Crea el pedido en BD, notifica cocina por WebSocket, limpia carrito y envía mensaje final."""
        cart = dict(session.cart_data)
        confirmed_name    = cart.get("customer_name", "").strip() or (customer.saved_name or "").strip()
        confirmed_address = cart.get("address", "").strip() or (customer.saved_address or "").strip()

        cart["customer_name"] = confirmed_name
        cart["address"]       = confirmed_address
        cart.pop("confirm_step", None)
        session.cart_data = cart
        db.commit()

        # Crear pedido → llega al Dashboard y Panel de Cocinas vía WebSocket
        order_id = OrderService.send_to_internal_software(db, customer, session)
        success  = bool(order_id)

        # Guardar nombre y dirección para futuros pedidos
        if confirmed_name:
            customer.saved_name = confirmed_name
        if confirmed_address:
            customer.saved_address = confirmed_address

        # Limpiar carrito
        cart["items"] = []
        cart["total"] = 0.0
        if order_id and order_id is not True:
            cart["last_order_id"] = order_id
        cart.pop("confirm_step", None)
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
                channel, sender_id, "¿Cuánto nos calificarías del 1 al 5? ⭐"
            )}]
        try:
            rating_int = int(rating)
            if rating_int < 1 or rating_int > 5:
                raise ValueError
        except (ValueError, TypeError):
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id, "Por favor califícanos con un número del 1 al 5 ⭐"
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
        cart = dict(session.cart_data)
        items_list = list(cart.get("items", []))
        if not items_list:
            return None

        txt = user_text.strip().lower()

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
        cart    = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cart.get("history", []))
        state   = session.state or "ACTIVO"

        # Si viene interactive_id (botón de plataforma), tratarlo como texto
        user_text = (text or interactive_id or "").strip()

        # ── Timeout de inactividad: 20 minutos ───────────────────────────────
        _INACTIVITY_TIMEOUT = timedelta(minutes=20)
        last_interaction = session.last_interaction_at
        if last_interaction is not None:
            if hasattr(last_interaction, "tzinfo") and last_interaction.tzinfo is not None:
                last_interaction = last_interaction.replace(tzinfo=None)
            inactive_states = {"PIDIENDO_NOTA", "PIDIENDO_NOMBRE", "PIDIENDO_DIRECCION", "CONFIRMANDO_PEDIDO", "CARRITO_PENDIENTE"}
            has_items = bool(cart.get("items"))
            if (datetime.utcnow() - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states and has_items:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                session.last_interaction_at = datetime.utcnow()
                db.commit()
                cart  = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. Tu pedido fue cancelado automáticamente. ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out

        session.last_interaction_at = datetime.utcnow()
        db.commit()

        # ── Sin mensaje ───────────────────────────────────────────────────────
        if not user_text:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Disculpa, no te entiendo 😅 Escribe *menú* para ver nuestros productos."
            )})
            return out

        txt_lower = user_text.strip().lower()

        # ══════════════════════════════════════════════════════════════════════
        # ESTADO CONFIRMANDO_PEDIDO — manejo de opciones numéricas
        # ══════════════════════════════════════════════════════════════════════
        if state == "CONFIRMANDO_PEDIDO":
            cart = dict(session.cart_data)
            step = cart.get("confirm_step", STEP_CART_OPTIONS)

            # ── Opciones post-carrito (1/2/3) ─────────────────────────────────
            if step == STEP_CART_OPTIONS:
                if txt_lower in {"1", "1️⃣", "confirmar", "confirmar pedido", "confirmo"}:
                    return BotEngine._start_confirm_flow(db, channel, sender_id, session, customer)

                if txt_lower in {"2", "2️⃣", "instrucciones", "agregar instrucciones", "nota"}:
                    cart["confirm_step"] = STEP_ASKING_NOTE
                    session.cart_data = cart
                    db.commit()
                    return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id,
                        "✍️ Escribe las instrucciones especiales para tu pedido\n(ej: sin cebolla, extra salsa, toca el timbre...)\n\nO escribe *no* si no tienes ninguna:"
                    )}]

                if txt_lower in {"3", "3️⃣", "agregar", "quitar", "agregar mas", "agregar más", "modificar"}:
                    session.state = "ACTIVO"
                    cart.pop("confirm_step", None)
                    session.cart_data = cart
                    db.commit()
                    return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id,
                        "¡Claro! ¿Qué más quieres agregar o quitar? 😊\n(Para quitar escribe: 'quita el 1')"
                    )}]

                # Cancelaciones
                if txt_lower in {"cancelar", "cancel", "no quiero", "olvídalo", "olvidalo"}:
                    return BotEngine._execute_cancel_order(db, channel, sender_id, session)

                # Opción no reconocida → reenviar opciones
                summary = _format_cart_summary(cart.get("items", []))
                cart_body = (
                    f"🛒 Tu pedido:\n{summary}\n\n"
                    f"💰 Total: ${cart.get('total', 0.0)}"
                )
                options_text = "1️⃣ Confirmar pedido\n2️⃣ Agregar instrucciones\n3️⃣ Agregar / quitar productos"
                return BotEngine._unrecognized_option(channel, sender_id, options_text) + \
                       [{"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)}]

            # ── Esperando instrucciones especiales ────────────────────────────
            if step == STEP_ASKING_NOTE:
                nota = user_text.strip()
                if nota.lower() not in {"no", "ninguna", "nada", "sin nota", "n", "no gracias"}:
                    cart["notes"] = nota[:200]
                else:
                    cart["notes"] = ""
                cart["confirm_step"] = STEP_ASKING_NAME
                session.cart_data = cart
                db.commit()
                return BotEngine._ask_name_msg(channel, sender_id, customer)

            # ── Esperando 1/2 sobre nombre+dirección guardados ────────────────
            if step == STEP_AWAITING_YES_NO:
                if txt_lower in {"1", "1️⃣", "si", "sí", "yes", "ok", "dale", "confirmar", "confirmo"}:
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)

                if txt_lower in {"2", "2️⃣", "no", "cambiar", "modificar"}:
                    cart["confirm_step"] = STEP_ASKING_NAME
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_name_msg(channel, sender_id, customer)

                # Opción no reconocida
                saved_name    = (customer.saved_name or "").strip()
                saved_address = (customer.saved_address or "").strip()
                body = f"¿Lo enviamos a nombre de *{saved_name}* a *{saved_address}*?"
                options_text = "1️⃣ Sí, confirmar\n2️⃣ No, cambiar datos"
                return BotEngine._unrecognized_option(channel, sender_id, options_text) + \
                       [{"action": "SEND_TEXT", "payload": BotEngine._yes_no_msg(channel, sender_id, body)}]

            # ── Esperando 1/2 sobre nombre guardado ───────────────────────────
            if step == STEP_ASKING_NAME:
                saved_name = (customer.saved_name or "").strip()
                if saved_name:
                    if txt_lower in {"1", "1️⃣", "si", "sí", "yes", "ok", "dale", "confirmar"}:
                        cart["customer_name"] = saved_name
                        cart["confirm_step"] = STEP_ASKING_ADDRESS
                        session.cart_data = cart
                        db.commit()
                        return BotEngine._ask_address_msg(channel, sender_id, customer)

                    if txt_lower in {"2", "2️⃣", "cambiar", "no", "modificar"}:
                        cart["confirm_step"] = STEP_TYPING_NAME
                        session.cart_data = cart
                        db.commit()
                        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                            channel, sender_id, "¿Cuál es tu nombre? Escríbelo 😊"
                        )}]

                    # Opción no reconocida
                    options_text = f"1️⃣ Sí, es {saved_name}\n2️⃣ Cambiar nombre"
                    return BotEngine._unrecognized_option(channel, sender_id, options_text) + \
                           [{"action": "SEND_TEXT", "payload": BotEngine._name_confirm_msg(channel, sender_id, saved_name)}]
                else:
                    # No hay nombre guardado → cualquier texto es el nombre
                    if user_text and len(user_text.strip()) >= 2:
                        cart["customer_name"] = user_text.strip()[:80]
                        cart["confirm_step"] = STEP_ASKING_ADDRESS
                        session.cart_data = cart
                        db.commit()
                        return BotEngine._ask_address_msg(channel, sender_id, customer)
                    return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id, "Por favor escribe tu nombre para continuar 😊"
                    )}]

            # ── Esperando texto libre del nombre ──────────────────────────────
            if step == STEP_TYPING_NAME:
                if user_text and len(user_text.strip()) >= 2:
                    cart["customer_name"] = user_text.strip()[:80]
                    cart["confirm_step"] = STEP_ASKING_ADDRESS
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._ask_address_msg(channel, sender_id, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor escribe tu nombre para continuar 😊"
                )}]

            # ── Esperando 1/2 sobre dirección guardada ────────────────────────
            if step == STEP_ASKING_ADDRESS:
                saved_address = (customer.saved_address or "").strip()
                if saved_address:
                    if txt_lower in {"1", "1️⃣", "si", "sí", "yes", "ok", "dale", "confirmar", "esa misma", "la misma"}:
                        cart["address"] = saved_address
                        session.cart_data = cart
                        db.commit()
                        return BotEngine._finalize_order(db, channel, sender_id, session, customer)

                    if txt_lower in {"2", "2️⃣", "cambiar", "no", "modificar"}:
                        cart["confirm_step"] = STEP_TYPING_ADDRESS
                        session.cart_data = cart
                        db.commit()
                        return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                            channel, sender_id,
                            "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍"
                        )}]

                    # Opción no reconocida
                    options_text = f"1️⃣ Sí, esa dirección\n2️⃣ Cambiar dirección"
                    return BotEngine._unrecognized_option(channel, sender_id, options_text) + \
                           [{"action": "SEND_TEXT", "payload": BotEngine._address_confirm_msg(channel, sender_id, saved_address)}]
                else:
                    # No hay dirección guardada → cualquier texto es la dirección
                    if user_text and len(user_text.strip()) > 5:
                        cart["address"] = user_text.strip()[:_MAX_ADDRESS_LEN]
                        session.cart_data = cart
                        db.commit()
                        return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                    return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id,
                        "Por favor escribe tu dirección de entrega completa 📍"
                    )}]

            # ── Esperando texto libre de la dirección ─────────────────────────
            if step == STEP_TYPING_ADDRESS:
                if user_text and len(user_text.strip()) > 5:
                    cart["address"] = user_text.strip()[:_MAX_ADDRESS_LEN]
                    session.cart_data = cart
                    db.commit()
                    return BotEngine._finalize_order(db, channel, sender_id, session, customer)
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Por favor escribe tu dirección de entrega completa 📍"
                )}]

            # Cancelaciones en cualquier sub-paso
            if txt_lower in {"cancelar", "cancel", "no quiero", "olvídalo", "olvidalo"}:
                return BotEngine._execute_cancel_order(db, channel, sender_id, session)

            # Fallback: volver a mostrar opciones del carrito
            session.state = "ACTIVO"
            db.commit()
            state = "ACTIVO"

        # ══════════════════════════════════════════════════════════════════════
        # ESTADO CARRITO_PENDIENTE
        # ══════════════════════════════════════════════════════════════════════
        if state == "CARRITO_PENDIENTE":
            CONTINUAR = {"continuar", "seguir", "sí", "si", "yes", "ok", "dale", "claro", "va", "ese mismo", "el mismo", "1", "1️⃣"}
            NUEVO     = {"nuevo", "empezar", "empezar nuevo", "nuevo pedido", "limpiar", "borrar", "eliminar", "no", "nope", "2", "2️⃣"}
            if txt_lower in CONTINUAR:
                session.state = "ACTIVO"
                db.commit()
                return BotEngine._execute_view_cart(channel, sender_id, session, db)
            if txt_lower in NUEVO:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                db.commit()
                return BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
            active_items = cart.get("items", [])
            summary = _format_cart_summary(active_items)
            body = (
                f"⚠️ Opción no reconocida.\n\n"
                f"Tienes este pedido en curso:\n\n"
                f"{summary}\n\n"
                f"💰 Total: ${cart.get('total', 0.0)}\n\n"
                f"1️⃣ Continuar con este pedido\n"
                f"2️⃣ Empezar uno nuevo"
            )
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)})
            return out

        # ══════════════════════════════════════════════════════════════════════
        # ESTADO ACTIVO — flujo normal
        # ══════════════════════════════════════════════════════════════════════

        # ── Palabras clave de reinicio / saludo ───────────────────────────────
        RESET_KEYWORDS = {"hola", "menu", "menú", "inicio", "start", "reiniciar", "hi", "buenas", "buenos", "hey"}
        if txt_lower in RESET_KEYWORDS:
            active_items = cart.get("items", [])
            if active_items:
                summary = _format_cart_summary(active_items)
                total   = cart.get("total", 0.0)
                session.state = "CARRITO_PENDIENTE"
                db.commit()
                body = (
                    f"🛒 Tienes un pedido en curso:\n\n"
                    f"{summary}\n\n"
                    f"💰 Total: ${total}\n\n"
                    f"1️⃣ Continuar con este pedido\n"
                    f"2️⃣ Empezar uno nuevo"
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body)})
                return out

            saved_name = (customer.saved_name or "").strip()
            if saved_name:
                first    = saved_name.split()[0].capitalize()
                greeting = f"¡Hola {first}! 😊 Un gusto tenerte de vuelta. ¿Qué vas a ordenar hoy?"
            else:
                greeting = f"¡Hola! 😊 Bienvenido a {org_name}. ¿Qué vas a ordenar hoy?"

            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id, greeting=greeting))
            return out

        # ── Palabras clave para confirmar pedido ──────────────────────────────
        CONFIRM_KEYWORDS = {"confirmar pedido", "confirmar", "confirmo", "cerrar pedido", "finalizar pedido", "terminar pedido"}
        if txt_lower in CONFIRM_KEYWORDS:
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

        # ── Resolver variante pendiente ───────────────────────────────────────
        pending_item    = cart.get("pending_variant_base")
        pending_options = cart.get("pending_variant_options", [])
        if pending_item and user_text:
            AFFIRMATIVE_VAGUE = {
                "damela", "dámela", "esa", "ese", "dale", "ok", "va", "sí", "si",
                "claro", "bueno", "listo", "perfecto", "sale", "órale", "orale",
                "la quiero", "lo quiero", "quiero esa", "quiero ese",
                "de esa", "de ese", "esa misma", "ese mismo",
            }
            matched_item = None
            for mi in menu_items:
                mi_name_low = mi.name.lower()
                if pending_item.lower() in mi_name_low and txt_lower in mi_name_low:
                    matched_item = mi
                    break
            if not matched_item and pending_options:
                for opt in pending_options:
                    if opt in txt_lower:
                        for mi in menu_items:
                            mi_name_low = mi.name.lower()
                            if pending_item.lower() in mi_name_low and opt in mi_name_low:
                                matched_item = mi
                                break
                        if matched_item:
                            break
            if not matched_item and txt_lower in AFFIRMATIVE_VAGUE and len(pending_options) == 1:
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
            elif txt_lower in AFFIRMATIVE_VAGUE and len(pending_options) > 1:
                opts_str = " o ".join(f"*{o.capitalize()}*" for o in pending_options)
                msg = _clean_text(channel, f"¿Cómo la quieres? {opts_str} 😊")
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", msg)
                db.commit()
                return [{"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)}]
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
                result = BotEngine._execute_view_cart(channel, sender_id, session, db)
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
                    ai_reply_parts.append("Cantidad actualizada.")

            elif action == "REMOVE_FROM_CART":
                item_id = ai_action.get("item_id")
                if item_id is None:
                    msg = "No identifiqué cuál producto quieres quitar. ¿Puedes decirme el nombre exacto?"
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                    ai_reply_parts.append(msg)
                else:
                    result = BotEngine._execute_remove_from_cart(db, channel, sender_id, session, int(item_id))
                    out.extend(result)
                    ai_reply_parts.append("Producto eliminado.")

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
                ai_reply_parts.append("Queja registrada.")

            else:  # CHAT
                _fallback = "Disculpa, no entendí tu pedido 😅 ¿Me lo repites?"
                message_text = ai_action.get("message") or _fallback
                if not message_text.strip():
                    message_text = _fallback
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, message_text)})
                ai_reply_parts.append(message_text)

                # Detectar pregunta de variante
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

        # ── Si hay items en el carrito pero no se mostraron las opciones, forzarlas ──
        cart_now = dict(session.cart_data)
        items_now = cart_now.get("items", [])
        # Detectar si algún mensaje ya incluye las opciones 1️⃣
        already_has_options = any(
            "1️⃣" in str(m.get("payload", {}).get("text", {}).get("body", "") or
                         m.get("payload", {}).get("message", {}).get("text", ""))
            for m in out
        )
        if items_now and not already_has_options:
            summary = _format_cart_summary(items_now)
            cart_body = (
                f"🛒 Tu pedido ({len(items_now)} producto{'s' if len(items_now) > 1 else ''}):\n"
                f"{summary}\n\n"
                f"💰 Total: ${cart_now.get('total', 0.0)}"
            )
            cart_now["confirm_step"] = STEP_CART_OPTIONS
            session.cart_data = cart_now
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()
            out.append({"action": "SEND_TEXT", "payload": BotEngine._cart_options_msg(channel, sender_id, cart_body)})

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
