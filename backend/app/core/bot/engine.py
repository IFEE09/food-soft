"""
BotEngine — Máquina de estados central del bot omnicanal.
Soporta WhatsApp, Facebook Messenger e Instagram DM.

Estados del flujo de pedido:
  NUEVO_USUARIO      → Primer contacto. Muestra menú.
  VIENDO_MENU        → Mostrando catálogo. Esperando selección.
  ARMANDO_PEDIDO     → Producto(s) en carrito. Pregunta si agrega más o termina.
  PIDIENDO_DATOS     → Solicitando dirección de entrega.
  CONFIRMANDO_PEDIDO → Mostrando resumen. Esperando confirmación final.
"""
import re
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import models
from app.core.bot.adapters import WhatsAppAdapter, MessengerAdapter, InstagramAdapter
from app.core.bot.orders import OrderService

logger = logging.getLogger(__name__)

_MAX_ADDRESS_LEN = 200
_MAX_TEXT_LEN = 1000
_SANITIZE_RE = re.compile(r"[<>\"'%;()&+]")


def _sanitize(text: str, max_len: int = _MAX_TEXT_LEN) -> str:
    return _SANITIZE_RE.sub("", text or "").strip()[:max_len]


def _round_price(value: float) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class BotEngine:

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
                state="NUEVO_USUARIO",
                cart_data={"items": [], "total": 0.0},
            )
            db.add(session)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                session = db.query(models.BotSession).filter_by(customer_id=customer.id).first()

        return customer, session

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
        elements = [
            {
                "title": item.name,
                "subtitle": f"${_round_price(item.price)}",
                "buttons": [{"type": "postback", "title": "Agregar", "payload": f"add_item_{item.id}"}],
            }
            for item in menu_items
        ]
        if channel == "messenger":
            return MessengerAdapter.format_generic_template(to, elements)
        return InstagramAdapter.format_generic_template(to, elements)

    @staticmethod
    def process_message(
        db: Session,
        organization_id: int,
        channel: str,
        sender_id: str,
        text: str,
        interactive_id: Optional[str] = None,
    ) -> list:
        out = []
        customer, session = BotEngine.get_or_create_session(db, organization_id, channel, sender_id)
        safe_text = _sanitize(text)

        if safe_text.lower() in ("hola", "menu", "menú", "reiniciar", "inicio", "start"):
            session.state = "VIENDO_MENU"
            session.cart_data = {"items": [], "total": 0.0}
            db.commit()

        state = session.state

        # ── NUEVO_USUARIO / VIENDO_MENU ──────────────────────────────────────
        if state in ("NUEVO_USUARIO", "VIENDO_MENU"):
            items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
            if not items:
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¡Hola! Por el momento no tenemos productos disponibles. Inténtalo más tarde."
                )})
                return out
            out.append({"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)})
            session.state = "ARMANDO_PEDIDO"
            session.cart_data = {"items": [], "total": 0.0}
            db.commit()
            return out

        # ── ARMANDO_PEDIDO ───────────────────────────────────────────────────
        if state == "ARMANDO_PEDIDO":
            raw_id = interactive_id or ""

            if raw_id == "btn_finish_order":
                cart = session.cart_data or {}
                if not cart.get("items"):
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id, "Tu carrito está vacío. Selecciona al menos un producto."
                    )})
                    items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
                    out.append({"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)})
                    return out
                session.state = "PIDIENDO_DATOS"
                db.commit()
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "¿A qué dirección enviamos tu pedido? (escribe tu dirección completa)"
                )})
                return out

            if raw_id == "btn_add_more":
                items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
                out.append({"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)})
                return out

            selected_id = None
            if raw_id.startswith("add_item_"):
                try:
                    selected_id = int(raw_id.split("_")[-1])
                except ValueError:
                    pass

            if selected_id is None:
                items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Por favor, selecciona un producto del menú:"
                )})
                out.append({"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)})
                return out

            menu_item = (
                db.query(models.MenuItem)
                .filter(models.MenuItem.id == selected_id, models.MenuItem.organization_id == organization_id)
                .first()
            )
            if not menu_item:
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id, "Ese producto ya no está disponible. Elige otro:"
                )})
                items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(10).all()
                out.append({"action": "SEND_MENU", "payload": BotEngine._menu(channel, sender_id, items)})
                return out

            cart = dict(session.cart_data) if session.cart_data else {"items": [], "total": 0.0}
            cart["items"] = list(cart.get("items", []))
            cart["items"].append({
                "id": menu_item.id,
                "name": menu_item.name,
                "qty": 1,
                "price": _round_price(menu_item.price),
            })
            cart["total"] = _round_price(sum(it["price"] * it["qty"] for it in cart["items"]))
            session.cart_data = cart
            db.commit()

            summary = "\n".join(
                f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
                for it in cart["items"]
            )
            body = (
                f"✅ Agregado: {menu_item.name}\n\n"
                f"🛒 Tu pedido ({len(cart['items'])} producto{'s' if len(cart['items']) > 1 else ''}):\n"
                f"{summary}\n\n"
                f"Total: ${cart['total']}\n\n"
                f"¿Deseas agregar algo más o terminar el pedido?"
            )
            out.append({"action": "SEND_BUTTONS", "payload": BotEngine._buttons(
                channel, sender_id, body,
                [{"id": "btn_add_more", "title": "Agregar más"}, {"id": "btn_finish_order", "title": "Terminar pedido"}],
            )})
            return out

        # ── PIDIENDO_DATOS ───────────────────────────────────────────────────
        if state == "PIDIENDO_DATOS":
            if not safe_text:
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Por favor escribe tu dirección de entrega para continuar."
                )})
                return out

            address = safe_text[:_MAX_ADDRESS_LEN]
            cart = dict(session.cart_data) if session.cart_data else {}
            cart["address"] = address
            session.cart_data = cart
            session.state = "CONFIRMANDO_PEDIDO"
            db.commit()

            summary = "\n".join(
                f"• {it['name']} x{it['qty']} — ${_round_price(it['price'] * it['qty'])}"
                for it in cart.get("items", [])
            )
            body = (
                f"Resumen de tu pedido:\n\n"
                f"{summary}\n\n"
                f"Dirección: {address}\n"
                f"Total: ${cart.get('total', 0.0)}\n\n"
                f"¿Confirmamos el pedido?"
            )
            out.append({"action": "SEND_BUTTONS", "payload": BotEngine._buttons(
                channel, sender_id, body,
                [{"id": "btn_confirm_order", "title": "Sí, confirmar"}, {"id": "btn_cancel_order", "title": "Cancelar"}],
            )})
            return out

        # ── CONFIRMANDO_PEDIDO ───────────────────────────────────────────────
        if state == "CONFIRMANDO_PEDIDO":
            if interactive_id == "btn_confirm_order":
                cart = session.cart_data or {}
                if not cart.get("items"):
                    session.state = "VIENDO_MENU"
                    session.cart_data = {"items": [], "total": 0.0}
                    db.commit()
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id, "Tu carrito estaba vacío. ¡Volvamos a empezar!"
                    )})
                    return out

                success = OrderService.send_to_internal_software(db, customer, session)
                session.state = "VIENDO_MENU"
                session.cart_data = {"items": [], "total": 0.0}
                db.commit()

                if success:
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id,
                        "¡Pedido confirmado! Tu orden está en camino a la cocina. Te avisaremos cuando esté listo."
                    )})
                else:
                    out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                        channel, sender_id,
                        "Lo sentimos, tuvimos un problema técnico. Por favor inténtalo de nuevo."
                    )})
                return out

            if interactive_id == "btn_cancel_order":
                session.state = "VIENDO_MENU"
                session.cart_data = {"items": [], "total": 0.0}
                db.commit()
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Pedido cancelado. ¡Cuando quieras volver a pedir, aquí estaremos!"
                )})
                return out

            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Por favor usa los botones para confirmar o cancelar tu pedido."
            )})
            return out

        # ── Estado desconocido: reiniciar ────────────────────────────────────
        logger.warning("Estado desconocido '%s' para customer_id=%s. Reiniciando.", state, customer.id)
        session.state = "VIENDO_MENU"
        session.cart_data = {"items": [], "total": 0.0}
        db.commit()
        out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
            channel, sender_id,
            "¡Hola! Escríbenos 'menu' para ver nuestro catálogo."
        )})
        return out
