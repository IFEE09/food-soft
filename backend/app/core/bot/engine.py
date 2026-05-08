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
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.bot import _actions, _confirm, _orders_actions
from app.core.bot import _messages as _msg
from app.core.bot._constants import (
    MAX_ADDRESS_LEN as _MAX_ADDRESS_LEN,
)
from app.core.bot._constants import (
    MAX_HISTORY as _MAX_HISTORY,
)
from app.core.bot._constants import (
    STEP_ASKING_ADDRESS,
    STEP_ASKING_NAME,
    STEP_ASKING_NOTE,
    STEP_AWAITING_YES_NO,
    STEP_CART_OPTIONS,
    STEP_TYPING_ADDRESS,
    STEP_TYPING_NAME,
)
from app.core.bot._formatters import (
    clean_text as _clean_text,
)
from app.core.bot._formatters import (
    format_cart_summary as _format_cart_summary,
)
from app.core.bot.deepseek_client import ask_deepseek
from app.db import models

logger = logging.getLogger(__name__)


class BotEngine:

    # ── Helpers de formato (wrappers a app.core.bot._messages) ────────────────
    # Mantenidos como métodos estáticos para que callers internos sigan usando
    # `BotEngine._text(...)` sin cambios. Implementación delegada para reuso.

    _image = staticmethod(_msg.image)
    _text = staticmethod(_msg.text)
    _cart_options_msg = staticmethod(_msg.cart_options_msg)
    _yes_no_msg = staticmethod(_msg.yes_no_msg)
    _name_confirm_msg = staticmethod(_msg.name_confirm_msg)
    _address_confirm_msg = staticmethod(_msg.address_confirm_msg)
    _unrecognized_option = staticmethod(_msg.unrecognized_option)

    # ── Gestión de sesión ─────────────────────────────────────────────────────

    @staticmethod
    def get_or_create_session(
        db: Session, org_id: int, channel: str, sender_id: str
    ) -> tuple[models.BotCustomer, models.BotSession]:
        # 1. Try to find customer
        customer = db.query(models.BotCustomer).filter_by(
            organization_id=org_id,
            channel_user_id=sender_id,
            channel=channel,
        ).first()
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
                # If someone else created it in the meantime, fetch it
                customer = db.query(models.BotCustomer).filter_by(
                    organization_id=org_id,
                    channel_user_id=sender_id,
                    channel=channel,
                ).first()
        if customer is None:
            raise RuntimeError("No se pudo crear ni recuperar BotCustomer.")

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
        if session is None:
            raise RuntimeError("No se pudo crear ni recuperar BotSession.")

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

    # ── Action handlers (wrappers a app.core.bot._actions) ────────────────────
    # Mantenemos las firmas viejas (incluyendo `db`/`organization_id` aunque algunos
    # no los usen) por compatibilidad con tests y callers internos del state machine.

    @staticmethod
    def _execute_show_menu(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int,
        greeting: str | None = None,
    ) -> list:
        return _actions.show_menu(channel, sender_id, greeting=greeting)

    @staticmethod
    def _execute_add_to_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, item_id: int,
        item_note: str | None = None,
    ) -> list:
        return _actions.add_to_cart(
            db, channel, sender_id, session, organization_id, item_id, item_note=item_note,
        )

    @staticmethod
    def _execute_view_cart(
        channel: str, sender_id: str, session: models.BotSession,
        db: Session | None = None,
    ) -> list:
        return _actions.view_cart(channel, sender_id, session, db=db)

    @staticmethod
    def _execute_update_quantity(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int, quantity: int,
    ) -> list:
        return _actions.update_quantity(db, channel, sender_id, session, item_id, quantity)

    @staticmethod
    def _execute_remove_from_cart(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, item_id: int,
    ) -> list:
        return _actions.remove_from_cart(db, channel, sender_id, session, item_id)

    @staticmethod
    def _execute_cancel_order(
        db: Session, channel: str, sender_id: str, session: models.BotSession,
    ) -> list:
        return _actions.cancel_order(db, channel, sender_id, session)

    # ── Flujo de confirmación ─────────────────────────────────────────────────

    # ── Confirm flow (wrappers a app.core.bot._confirm) ──────────────────────

    _start_confirm_flow = staticmethod(_confirm.start_confirm_flow)
    _ask_name_msg       = staticmethod(_confirm.ask_name_msg)
    _ask_address_msg    = staticmethod(_confirm.ask_address_msg)
    _finalize_order     = staticmethod(_confirm.finalize_order)

    # ── Estado del pedido, calificación y quejas ──────────────────────────────

    @staticmethod
    def _execute_check_order_status(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int,
    ) -> list:
        return _orders_actions.check_order_status(
            db, channel, sender_id, session, organization_id,
        )

    @staticmethod
    def _execute_rate_order(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int, rating,
    ) -> list:
        return _orders_actions.rate_order(db, channel, sender_id, session, rating)

    @staticmethod
    def _execute_complaint(
        db: Session, channel: str, sender_id: str,
        session: models.BotSession, organization_id: int,
        customer: models.BotCustomer, complaint_text: str,
    ) -> list:
        return _orders_actions.submit_complaint(
            db, channel, sender_id, organization_id, customer, complaint_text,
        )

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
        text: str | None = None,
        interactive_id: str | None = None,
    ) -> list:
        out = []
        customer, session = BotEngine.get_or_create_session(db, organization_id, channel, sender_id)

        org = db.query(models.Organization).filter_by(id=organization_id).first()
        org_name = org.name if org else "Horno 74"

        menu_items = db.query(models.MenuItem).filter_by(organization_id=organization_id).limit(50).all()
        promotions = db.query(models.Promotion).filter_by(organization_id=organization_id, is_active=True).all()
        cart: dict[str, Any] = dict(session.cart_data) if isinstance(session.cart_data, dict) else {"items": [], "total": 0.0, "history": []}
        history = list(cast(list, cart.get("history", [])))
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
            if (datetime.now(UTC).replace(tzinfo=None) - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states and has_items:
                clean_cart: dict[str, Any] = {"items": [], "total": 0.0, "history": list(cast(list, cart.get("history", [])))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                session.last_interaction_at = datetime.now(UTC)
                db.commit()
                cart  = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. Tu pedido fue cancelado automáticamente. ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out
        session.last_interaction_at = datetime.now(UTC)
        db.commit()

        # ── Manejo directo de botones del catálogo (bypass IA) ────────────────
        if interactive_id and interactive_id.startswith("add_item_"):
            try:
                item_id = int(interactive_id.split("_")[-1])
                out.extend(BotEngine._execute_add_to_cart(db, channel, sender_id, session, organization_id, item_id))
                BotEngine._append_history(session, "user", f"[Botón: {interactive_id}]")
                BotEngine._append_history(session, "assistant", "Producto agregado vía catálogo.")
                db.commit()
                return out
            except Exception as e:
                logger.error("Error al agregar item desde catálogo: %s", e)

        # ── Sin mensaje ───────────────────────────────────────────────────────
        if not user_text:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Disculpa, no te entiendo 😅 Escribe *menú* para ver nuestros productos."
            )})
            return out

        txt_lower = user_text.strip().lower()

        # ── Saludo con carrito activo: siempre tiene prioridad sobre cualquier estado ──
        _GREETING_KEYWORDS = {
            "hola", "menu", "menú", "inicio", "start", "reiniciar",
            "hi", "hey", "hello",
            "buenas", "buenos",
            "buenas noches", "buenas tardes", "buenos días", "buenos dias",
            "buen día", "buen dia",
            "que hay", "qué hay", "que onda", "qué onda",
            "ver menu", "ver menú", "quiero pedir", "quiero ordenar",
        }
        _is_greeting_early = txt_lower in _GREETING_KEYWORDS or any(
            txt_lower.startswith(kw) for kw in ("hola", "buenas", "buenos", "hi ", "hey ", "hello")
        )
        if _is_greeting_early and state in ("CONFIRMANDO_PEDIDO", "CARRITO_PENDIENTE"):
            active_items_early = cast(list, cart.get("items", []))
            if active_items_early:
                summary_early = _format_cart_summary(active_items_early)
                total_early   = cart.get("total", 0.0)
                session.state = "CARRITO_PENDIENTE"
                db.commit()
                body_early = (
                    f"🛒 Tienes un pedido en curso:\n\n"
                    f"{summary_early}\n\n"
                    f"💰 Total: ${total_early}\n\n"
                    f"1️⃣ Continuar con este pedido\n"
                    f"2️⃣ Empezar uno nuevo"
                )
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(channel, sender_id, body_early)})
                return out

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
                    options_text = "1️⃣ Sí, esa dirección\n2️⃣ Cambiar dirección"
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
                clean_cart: dict[str, Any] = {"items": [], "total": 0.0, "history": list(cast(list, cart.get("history", [])))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                db.commit()
                return BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id)
            active_items = cast(list, cart.get("items", []))
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
        RESET_KEYWORDS = {
            "hola", "menu", "menú", "inicio", "start", "reiniciar",
            "hi", "hey", "hello",
            "buenas", "buenos",
            "buenas noches", "buenas tardes", "buenos días", "buenos dias",
            "buen día", "buen dia", "buen provecho",
            "que hay", "qué hay", "que onda", "qué onda",
            "ver menu", "ver menú", "quiero pedir", "quiero ordenar",
        }
        # También capturar si el mensaje EMPIEZA con saludo (ej: "buenas noches!")
        is_greeting = txt_lower in RESET_KEYWORDS or any(
            txt_lower.startswith(kw) for kw in (
                "hola", "buenas", "buenos", "hi ", "hey ", "hello"
            )
        )
        if is_greeting:
            active_items = cast(list, cart.get("items", []))
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
        pending_item: str | None = cast(str | None, cart.get("pending_variant_base"))
        pending_options: list = cast(list, cart.get("pending_variant_options", []))
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

        # ── Solución 4: Re-llamar a DeepSeek si solo devolvió CHAT y el usuario pidió un producto ──
        # SOLO activa si NO hay una variante pendiente (Grande/Familiar) — para no interferir
        # con el flujo de selección de tamaño.
        _all_chat = all(a.get("action") == "CHAT" for a in actions_list)
        _has_pending_variant = bool(cart.get("pending_variant_base"))
        if _all_chat and not _has_pending_variant:
            _user_lower = user_text.lower()
            _product_mentioned = next(
                (mi for mi in menu_items if mi.name.lower() in _user_lower),
                None
            )
            if _product_mentioned:
                logger.warning(
                    "[DEEPSEEK-RETRY] Solo CHAT para '%s' que menciona producto '%s'. Reintentando.",
                    user_text, _product_mentioned.name
                )
                _retry_msg = (
                    f"SISTEMA: El cliente pidió '{_product_mentioned.name}' (ID:{_product_mentioned.id}). "
                    f"Debes responder SOLO con: [{{\"action\": \"ADD_TO_CART\", \"item_id\": {_product_mentioned.id}}}]"
                )
                _retry_response = ask_deepseek(
                    message=_retry_msg,
                    chat_history=history,
                    menu_items=menu_items,
                    cart=cart,
                    state=state,
                    org_name=org_name,
                    promotions=promotions,
                )
                _retry_list = _retry_response if isinstance(_retry_response, list) else [_retry_response]
                # Solo usar el retry si devolvió ADD_TO_CART (no forzar si también falla)
                if any(a.get("action") == "ADD_TO_CART" for a in _retry_list):
                    logger.info("[DEEPSEEK-RETRY] Éxito. Usando respuesta del retry: %s", _retry_list)
                    actions_list = _retry_list
                else:
                    logger.warning("[DEEPSEEK-RETRY] Retry también falló. Dejando respuesta CHAT original.")

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

                # ── Solución 2: Interceptar CHAT que confirma un producto ────────
                # Si DeepSeek dijo "X agregado" en CHAT pero no usó ADD_TO_CART,
                # buscamos el producto en el menú y lo agregamos automáticamente.
                _chat_lower = message_text.lower()
                _is_confirming = any(kw in _chat_lower for kw in [
                    "agregado", "agregada", "añadido", "añadida",
                    "listo", "perfecto", "claro", "agregado a tu pedido"
                ])
                _intercepted = False
                if _is_confirming:
                    # Buscar si el mensaje menciona algún producto del menú
                    for mi in menu_items:
                        if mi.name.lower() in _chat_lower:
                            logger.warning(
                                "[CHAT-INTERCEPT] DeepSeek usó CHAT para confirmar '%s'. "
                                "Ejecutando ADD_TO_CART id=%s automáticamente.",
                                mi.name, mi.id
                            )
                            result = BotEngine._execute_add_to_cart(
                                db, channel, sender_id, session, organization_id, mi.id
                            )
                            out.extend(result)
                            ai_reply_parts.append(f"{mi.name} agregado (interceptado).")
                            _intercepted = True
                            break

                if not _intercepted:
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
        # Detectar si algún mensaje ya incluye las opciones 1️⃣ (búsqueda en todo el payload serializado)
        already_has_options = any(
            "1️⃣" in str(m)
            for m in out
        )
        # No activar la red de seguridad si hay una variante pendiente (pregunta Grande/Familiar)
        _has_pending_variant_now = bool(cart_now.get("pending_variant_base"))
        if items_now and not already_has_options and not _has_pending_variant_now:
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
