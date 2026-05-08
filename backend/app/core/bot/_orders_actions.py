"""
Acciones del bot relacionadas a pedidos: estado, calificación, quejas.

Separadas de _actions.py (cart) para mantener cada archivo enfocado.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.bot._messages import send_text_action
from app.db import models

_send_text = send_text_action


# ── Estado del pedido ────────────────────────────────────────────────────────


_ORDER_STATUS_MESSAGES = {
    "pending":   "🔄 Tu pedido está en cocina, siendo preparado. Tiempo estimado: 40-45 minutos.",
    "ready":     "✅ ¡Tu pedido está listo! Ya puede ser entregado.",
    "delivered": "📦 Tu pedido ya fue entregado. ¡Gracias por tu preferencia!",
}


def check_order_status(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    organization_id: int,
) -> list:
    cart: dict[str, Any] = dict(session.cart_data)
    last_order_id = cart.get("last_order_id")
    if not last_order_id:
        return [_send_text(
            channel, sender_id,
            "No encontré un pedido reciente tuyo. ¿Quieres hacer uno nuevo? 🍕",
        )]

    order = (
        db.query(models.Order)
        .filter(
            models.Order.id == last_order_id,
            models.Order.organization_id == organization_id,
        )
        .first()
    )
    if not order:
        return [_send_text(
            channel, sender_id,
            "No pude encontrar tu pedido. ¿Necesitas ayuda con algo más?",
        )]

    msg = _ORDER_STATUS_MESSAGES.get(order.status, f"Estado de tu pedido: {order.status}")
    return [_send_text(channel, sender_id, msg)]


# ── Calificación ─────────────────────────────────────────────────────────────


_RATING_EMOJIS = ["", "😢", "😕", "😐", "😊", "🤩"]
_RATING_RESPONSES = [
    "",
    "Lo sentimos mucho. Trabajaremos para mejorar. ¿Qué salió mal?",
    "Gracias por tu honestidad. Tomaremos en cuenta tu opinión.",
    "Gracias por tu calificación. ¡Seguiremos mejorando!",
    "¡Gracias! Nos alegra que hayas disfrutado tu pedido 😊",
    "¡Excelente! ¡Nos encanta saber que todo estuvo perfecto! 🤩🍕",
]


def rate_order(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    rating: Any,
) -> list:
    if rating is None:
        return [_send_text(channel, sender_id, "¿Cuánto nos calificarías del 1 al 5? ⭐")]

    try:
        rating_int = int(rating)
        if rating_int < 1 or rating_int > 5:
            raise ValueError
    except (ValueError, TypeError):
        return [_send_text(
            channel, sender_id,
            "Por favor califícanos con un número del 1 al 5 ⭐",
        )]

    cart: dict[str, Any] = dict(session.cart_data)
    cart["last_rating"] = rating_int
    session.cart_data = cart
    db.commit()

    msg = f"{_RATING_EMOJIS[rating_int]} {_RATING_RESPONSES[rating_int]}"
    return [_send_text(channel, sender_id, msg)]


# ── Quejas ───────────────────────────────────────────────────────────────────


_COMPLAINT_TEXT_MAX = 300


def submit_complaint(
    db: Session,
    channel: str,
    sender_id: str,
    organization_id: int,
    customer: models.BotCustomer,
    complaint_text: str,
) -> list:
    """Registra queja en activity log + notifica vía WebSocket al staff."""
    from app.core.activity import log_activity
    from app.core.notifier import schedule_notify_organization

    truncated = complaint_text[:_COMPLAINT_TEXT_MAX]

    log_activity(
        db, None,
        action="complaint",
        entity_type="bot_complaint",
        entity_id=customer.id,
        description=(
            f"Queja de cliente ({customer.channel}/{customer.channel_user_id}): {truncated}"
        ),
        organization_id=organization_id,
    )
    schedule_notify_organization(
        organization_id,
        {
            "type": "complaint",
            "customer_id": customer.id,
            "channel": customer.channel,
            "message": truncated,
        },
    )
    db.commit()

    return [_send_text(
        channel, sender_id,
        "Lamentamos mucho lo ocurrido 😟 Hemos notificado a nuestro equipo y "
        "nos pondremos en contacto contigo a la brevedad. ¡Gracias por avisarnos!",
    )]
