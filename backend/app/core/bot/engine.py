"""
BotEngine — Motor conversacional con IA (DeepSeek) para el bot omnicanal.

El motor usa DeepSeek para interpretar mensajes en lenguaje natural y
ejecutar acciones estructuradas sobre el sistema de pedidos.

Acciones que DeepSeek puede devolver:
  SHOW_MENU        → Mostrar el menú de productos
  ADD_TO_CART      → Agregar un producto al carrito
  ASK_ADDRESS      → Pedir dirección de entrega
  CONFIRM_ORDER    → Confirmar y enviar pedido a cocina
  CANCEL_ORDER     → Cancelar el pedido actual
  CHAT             → Respuesta de texto libre (preguntas, saludos, etc.)

El historial de conversación se guarda en BotSession.cart_data["history"]
para que DeepSeek mantenga el contexto entre mensajes.
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

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_HISTORY = 20  # Máximo de turnos a conservar en historial


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class BotEngine:

    # ── Helpers de formato ────────────────────────────────────────────────────

    @staticmethod
    def _text(channel: str, to: str, text: str) -> dict:
        if channel == "whatsapp":
            return WhatsAppAdapter.format_text(to, text)
        if channel == "messenger":
            return MessengerAdapter.format_text(to, text)
        return InstagramAdapter.format_text(to, text)

    @staticmethod
    def _buttons(channel: str, to: str, text: str, buttons: list) -> dict:
        if channel == "whatsapp":
            return WhatsAppAdapter.format_buttons(to, text, buttons)
        if channel == "messenger":
            return MessengerAdapter.format_quick_replies(to, text, buttons)
        return InstagramAdapter.format_quick_replies(to, text, buttons)

    @staticmethod
    def _menu(channel: str, to: str, menu_items: list) -> dict:
        if channel == "whatsapp":
            rows = [
                {
                    "id": f"add_item_{item.id}",
                    "title": item.name[:24],
                    "description": f"${_round_price(item.price)}",
                }
                for item in menu_items
            ]
            return WhatsAppAdapter.format_list(
                to=to,
                header_text="OMNIKOOK",
                body_text="Selecciona un producto para agregar a tu pedido:",
                button_text="Ver Menú",
                sections=[{"title": "Nuestro Menú", "rows": rows}],
            )
        # Messenger e Instagram: quick replies con nombre y precio
        elements = [
            {"id": f"add_item_{item.id}", "title": f"{item.name[:20]} ${_round_price(item.price)}"}
            for item in menu_items
        ]
        if channel == "messenger":
            return MessengerAdapter.format_quick_replies(
                to=to,
                text="Aquí está nuestro menú 🍽️ Toca el producto que quieras agregar:",
                buttons=elements,
            )
        return InstagramAdapter.format_quick_replies(
            to=to,
            text="Aquí está nuestro menú 🍽️ Toca el producto que quieras agregar:",
            buttons=elements,
        )

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

    # ── Resolver botones interactivos a texto ─────────────────────────────────

    @staticmethod
    def _resolve_interactive(interactive_id: str, menu_items: list) -> Optional[str]:
        if not interactive_id:
            return None
        if interactive_id.startswith("add_item_"):
            try:
                item_id = int(interactive_id.split("_")[-1])
                item = next((m for m in menu_items if m.id == item_id), None)
                if item:
                    return f"Quiero agregar {item.name}"
                return "Quiero agregar ese producto"
            except (ValueError, IndexError):
                return None
        if interactive_id == "btn_finish_order":
            return "Terminar pedido, quiero confirmar"
        if interactive_id == "btn_add_more":
            return "Quiero agregar más productos al carrito"
        if interactive_id == "btn_confirm_order":
            return "Sí, confirmo el pedido"
        if interactive_id == "btn_cancel_order":
            return "Cancelar el pedido"
        return None

    # ── Ejecutores de acciones ────────────────────────────────────────────────

    @staticmethod
    def _execute_show_menu(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int
    ) -> list:
        items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
        if not items:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por el momento no tenemos productos disponibles. ¡Vuelve pronto!"
            )}]
        return [{"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)}]

    @staticmethod
    def _execute_add_to_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, item_id: int
    ) -> list:
        menu_item = (
            db.query(models.MenuItem)
            .filter(models.MenuItem.id == item_id, models.MenuItem.organization_id == organization_id)
            .first()
        )
        if not menu_item:
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Ese producto no está disponible. ¿Quieres ver el menú actualizado?"
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
            f"Total: ${cart['total']}\n\n"
            f"¿Deseas agregar algo más o terminar el pedido?"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(
            channel, sender_id, body,
            [{"id": "btn_add_more", "title": "Agregar más"}, {"id": "btn_finish_order", "title": "Terminar pedido"}],
        )}]

    @staticmethod
    def _execute_ask_address(channel: str, sender_id: str, session: models.BotSession, db: Session) -> list:
        cart = dict(session.cart_data)
        if not cart.get("items"):
            return [{"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Tu carrito está vacío. Primero agrega productos del menú."
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
                "Tu carrito está vacío. Escribe 'menu' para ver nuestros productos."
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
            f"¿Confirmamos el pedido?"
        )
        return [{"action": "SEND_BUTTONS", "payload": BotEngine._buttons(
            channel, sender_id, body,
            [{"id": "btn_confirm_order", "title": "Sí, confirmar"}, {"id": "btn_cancel_order", "title": "Cancelar"}],
        )}]

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

    # ── Punto de entrada principal (mantiene nombre process_message) ──────────

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

        # Nombre de la organización para el system prompt
        org = db.query(models.Organization).filter_by(id=organization_id).first()
        org_name = org.name if org else "OMNIKOOK"

        # Cargar menú, carrito e historial
        menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
        cart = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cart.get("history", []))
        state = session.state or "ACTIVO"

        # ── Estado especial: confirmación final (no pasa por DeepSeek) ────────
        if state == "CONFIRMANDO_PEDIDO":
            if interactive_id == "btn_confirm_order" or (text and text.lower().strip() in ("sí", "si", "confirmar", "confirmo", "yes")):
                success = OrderService.send_to_internal_software(db, customer, session)
                cart = dict(session.cart_data)
                cart["items"] = []
                cart["total"] = 0.0
                session.cart_data = cart
                session.state = "ACTIVO"
                db.commit()
                msg = (
                    "¡Pedido confirmado! 🎉 Tu orden está en camino a la cocina. ¡Gracias por tu pedido!"
                    if success else
                    "Lo sentimos, tuvimos un problema técnico al procesar tu pedido. Por favor inténtalo de nuevo."
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, msg)})
                return out
            if interactive_id == "btn_cancel_order" or (text and text.lower().strip() in ("cancelar", "no", "cancel")):
                return BotEngine._execute_cancel_order(db, channel, sender_id, session)
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor usa los botones para confirmar o cancelar tu pedido."
            )})
            return out

        # ── Estado especial: esperando dirección (no pasa por DeepSeek) ───────
        if state == "PIDIENDO_DIRECCION":
            if text and len(text.strip()) > 5:
                return BotEngine._execute_confirm_order(db, channel, sender_id, session, customer, text.strip())
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor escribe tu dirección de entrega completa para continuar. 📍"
            )})
            return out

        # ── Resolver botones interactivos a texto para DeepSeek ───────────────
        user_message = (text or "").strip()
        if interactive_id:
            resolved = BotEngine._resolve_interactive(interactive_id, menu_items)
            if resolved:
                user_message = resolved
            elif not user_message:
                user_message = interactive_id

        if not user_message:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "¡Hola! Escríbeme o escribe 'menu' para ver nuestros productos. 😊"
            )})
            return out

        # ── Llamar a DeepSeek ─────────────────────────────────────────────────
        ai_response = ask_deepseek(
            message=user_message,
            chat_history=history,
            menu_items=menu_items,
            cart=cart,
            state=state,
            org_name=org_name,
        )

        action = ai_response.get("action", "CHAT")
        logger.info("DeepSeek action=%s para sender=%s channel=%s", action, sender_id, channel)

        # ── Ejecutar la acción devuelta por DeepSeek ──────────────────────────
        if action == "SHOW_MENU":
            result = BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
            out.extend(result)
            ai_reply = "Mostrando menú."

        elif action == "ADD_TO_CART":
            item_id = ai_response.get("item_id")
            if item_id is None:
                result = BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
                out.extend(result)
                ai_reply = "Mostrando menú para selección."
            else:
                result = BotEngine._execute_add_to_cart(
                    db, channel, sender_id, session, organization_id, int(item_id)
                )
                out.extend(result)
                ai_reply = f"Producto {item_id} agregado al carrito."

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
                ai_reply = "Solicitando dirección (no se recibió en la respuesta de IA)."

        elif action == "CANCEL_ORDER":
            result = BotEngine._execute_cancel_order(db, channel, sender_id, session)
            out.extend(result)
            ai_reply = "Pedido cancelado."

        else:  # CHAT u acción desconocida
            message_text = ai_response.get("message", "¿En qué más puedo ayudarte?")
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, message_text)})
            ai_reply = message_text

        # ── Guardar historial de conversación ─────────────────────────────────
        BotEngine._append_history(session, "user", user_message)
        BotEngine._append_history(session, "assistant", ai_reply)
        db.commit()

        return out
