"""
Flujo de confirmación — funciones del cierre de pedido.

Cubre:
- start_confirm_flow: muestra resumen + opción 1/2 con datos guardados
- ask_name_msg / ask_address_msg: preguntas individuales (con o sin datos)
- finalize_order: crea pedido en DB, notifica cocina, limpia carrito, mensaje final

NOTA: el handler de cada step interno (STEP_*) sigue en engine.py porque está
entrelazado con el state machine de process_message. Cuando se refactorice el
state machine completo, esos handlers también pueden migrar aquí.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.bot._constants import (
    STATE_ACTIVE,
    STATE_CONFIRMING,
    STEP_ASKING_NAME,
    STEP_AWAITING_YES_NO,
)
from app.core.bot._formatters import format_cart_summary
from app.core.bot._messages import (
    address_confirm_msg,
    name_confirm_msg,
    send_text_action,
    yes_no_msg,
)
from app.core.bot.orders import OrderService
from app.db import models

_send_text = send_text_action


# ── Inicio del flow ──────────────────────────────────────────────────────────


def start_confirm_flow(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    customer: models.BotCustomer,
) -> list:
    """Paso 1: muestra resumen + opciones 1/2 si hay nombre+dirección guardados.

    Si NO hay datos guardados → pasa directo a ASKING_NAME.
    """
    cart: dict[str, Any] = dict(session.cart_data)
    items_list = cart.get("items", [])
    if not items_list:
        return [_send_text(
            channel, sender_id,
            "Tu pedido está vacío. Dime qué quieres pedir primero 😊",
        )]

    saved_name    = (customer.saved_name or "").strip()
    saved_address = (customer.saved_address or "").strip()
    summary = format_cart_summary(items_list)

    if saved_name and saved_address:
        body = (
            f"📋 Tu pedido:\n{summary}\n\n"
            f"💰 Total: ${cart.get('total', 0.0)}\n\n"
            f"¿Lo enviamos a nombre de *{saved_name}* a *{saved_address}*?"
        )
        cart["confirm_step"] = STEP_AWAITING_YES_NO
        session.cart_data = cart
        session.state = STATE_CONFIRMING
        db.commit()
        return [{"action": "SEND_TEXT", "payload": yes_no_msg(channel, sender_id, body)}]

    # Sin datos → pedir nombre primero
    cart["confirm_step"] = STEP_ASKING_NAME
    session.cart_data = cart
    session.state = STATE_CONFIRMING
    db.commit()
    return ask_name_msg(channel, sender_id, customer)


# ── Preguntas individuales ───────────────────────────────────────────────────


def ask_name_msg(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
    saved_name = (customer.saved_name or "").strip()
    if saved_name:
        return [{"action": "SEND_TEXT", "payload": name_confirm_msg(channel, sender_id, saved_name)}]
    return [_send_text(
        channel, sender_id,
        "¿Cómo te llamas? Escribe tu nombre para el pedido 😊",
    )]


def ask_address_msg(channel: str, sender_id: str, customer: models.BotCustomer) -> list:
    saved_address = (customer.saved_address or "").strip()
    if saved_address:
        return [{"action": "SEND_TEXT", "payload": address_confirm_msg(channel, sender_id, saved_address)}]
    return [_send_text(
        channel, sender_id,
        "¿A qué dirección enviamos tu pedido? Escribe tu dirección completa 📍",
    )]


# ── Finalización (commit del pedido) ─────────────────────────────────────────


def finalize_order(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    customer: models.BotCustomer,
) -> list:
    """Crea el pedido en DB, notifica cocina vía WS, limpia carrito y envía mensaje final."""
    cart: dict[str, Any] = dict(session.cart_data)
    confirmed_name    = (cart.get("customer_name") or "").strip() or (customer.saved_name or "").strip()
    confirmed_address = (cart.get("address") or "").strip() or (customer.saved_address or "").strip()

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

    # Limpiar carrito y resetear estado
    cart["items"] = []
    cart["total"] = 0.0
    if order_id and order_id is not True:
        cart["last_order_id"] = order_id
    cart.pop("confirm_step", None)
    session.cart_data = cart
    session.state = STATE_ACTIVE
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
        msg = (
            "Lo sentimos, tuvimos un problema técnico al procesar tu pedido. "
            "Por favor inténtalo de nuevo."
        )

    return [_send_text(channel, sender_id, msg)]
