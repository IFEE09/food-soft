"""
Action handlers — funciones que mutan estado del cart y/o session.

Cada función es la implementación de una acción del bot ("agregar al carrito",
"ver carrito", "actualizar cantidad", etc). Reciben los recursos que necesitan
explícitamente; no hay estado oculto.

DURABILIDAD:
- Cada función tiene una sola responsabilidad.
- DB session se pasa por argumento → testeable con SQLite en memoria.
- No importan engine.py → cero ciclos. La engine las importa, no al revés.

NOTA: estas funciones MUTAN `session.cart_data` y hacen `db.commit()`. Cualquier
optimización futura (ej: batchear commits) debe revisarlas todas juntas.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.bot._constants import (
    MAX_NOTE_LEN,
    MENU_IMG,
    STATE_ACTIVE,
    STATE_CONFIRMING,
    STEP_CART_OPTIONS,
)
from app.core.bot._formatters import format_cart_summary, round_price
from app.core.bot._messages import cart_options_msg, image, send_text_action
from app.db import models

# Alias local para mantener legibilidad del código existente.
_send_text = send_text_action


def _send_image(channel: str, to: str, image_url: str) -> dict:
    return {"action": "SEND_IMAGE", "payload": image(channel, to, image_url)}


def _send_cart_options(channel: str, to: str, cart_body: str) -> dict:
    return {"action": "SEND_TEXT", "payload": cart_options_msg(channel, to, cart_body)}


def _items_count_label(items_list: list) -> str:
    """'1 producto' / '2 productos'."""
    n = len(items_list)
    return f"{n} producto{'s' if n > 1 else ''}"


def _recompute_total(items_list: list) -> float:
    return round_price(sum(it["price"] * it["qty"] for it in items_list))


# ── Show menu ─────────────────────────────────────────────────────────────────


def show_menu(channel: str, sender_id: str, greeting: str | None = None) -> list:
    out = []
    if greeting:
        out.append(_send_text(channel, sender_id, greeting))
    out.append(_send_image(channel, sender_id, MENU_IMG))
    out.append(_send_text(
        channel, sender_id,
        "Dime qué quieres pedir y con gusto te lo agrego 😊",
    ))
    return out


# ── Add to cart ───────────────────────────────────────────────────────────────


def add_to_cart(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    organization_id: int,
    item_id: int,
    item_note: str | None = None,
) -> list:
    menu_item = (
        db.query(models.MenuItem)
        .filter(
            models.MenuItem.id == item_id,
            models.MenuItem.organization_id == organization_id,
        )
        .first()
    )
    if not menu_item:
        return [_send_text(
            channel, sender_id,
            "Ese producto no está disponible en este momento. ¿Quieres ver el menú?",
        )]

    cart: dict[str, Any] = dict(session.cart_data)
    items_list = list(cart.get("items", []))
    clean_note = (item_note or "").strip()[:MAX_NOTE_LEN] or None

    existing = next(
        (it for it in items_list
         if it.get("id") == menu_item.id and it.get("note") == clean_note),
        None,
    )
    if existing:
        existing["qty"] += 1
    else:
        new_item: dict[str, Any] = {
            "id": menu_item.id,
            "name": menu_item.name,
            "qty": 1,
            "price": round_price(menu_item.price),
        }
        if clean_note:
            new_item["note"] = clean_note
        items_list.append(new_item)

    cart["items"] = items_list
    cart["total"] = _recompute_total(items_list)
    cart["confirm_step"] = STEP_CART_OPTIONS
    session.cart_data = cart
    session.state = STATE_CONFIRMING
    db.commit()

    nombre_con_nota = menu_item.name
    if clean_note:
        nombre_con_nota += f" (✎ {clean_note})"

    cart_body = (
        f"✅ Agregado: {nombre_con_nota}\n\n"
        f"🛒 Tu pedido ({_items_count_label(items_list)}):\n"
        f"{format_cart_summary(items_list)}\n\n"
        f"💰 Total: ${cart['total']}"
    )
    return [_send_cart_options(channel, sender_id, cart_body)]


# ── View cart ─────────────────────────────────────────────────────────────────


def view_cart(
    channel: str,
    sender_id: str,
    session: models.BotSession,
    db: Session | None = None,
) -> list:
    cart: dict[str, Any] = dict(session.cart_data)
    items_list = cart.get("items", [])
    if not items_list:
        return [_send_text(
            channel, sender_id,
            "Tu pedido está vacío. ¿Quieres ver el menú para pedir algo? 🍕",
        )]

    cart_body = (
        f"🛒 Tu pedido ({_items_count_label(items_list)}):\n"
        f"{format_cart_summary(items_list)}\n\n"
        f"💰 Total: ${cart.get('total', 0.0)}\n"
        f"(Para quitar: escribe 'quita el 1', para cambiar: 'ponme 2 del 3')"
    )
    if db is not None:
        cart["confirm_step"] = STEP_CART_OPTIONS
        session.cart_data = cart
        session.state = STATE_CONFIRMING
        db.commit()
    return [_send_cart_options(channel, sender_id, cart_body)]


# ── Update quantity ───────────────────────────────────────────────────────────


def update_quantity(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    item_id: int,
    quantity: int,
) -> list:
    cart: dict[str, Any] = dict(session.cart_data)
    items_list = list(cart.get("items", []))

    item = next((it for it in items_list if it.get("id") == item_id), None)
    if not item:
        return [_send_text(
            channel, sender_id,
            "Ese producto no está en tu pedido. ¿Quieres agregarlo?",
        )]

    if quantity <= 0:
        items_list = [it for it in items_list if it.get("id") != item_id]
        msg_prefix = f"✅ {item['name']} eliminado de tu pedido."
    else:
        item["qty"] = quantity
        msg_prefix = (
            f"✅ {item['name']} actualizado a {quantity} unidad"
            f"{'es' if quantity > 1 else ''}."
        )

    cart["items"] = items_list
    cart["total"] = _recompute_total(items_list)
    cart["confirm_step"] = STEP_CART_OPTIONS
    session.cart_data = cart
    session.state = STATE_CONFIRMING
    db.commit()

    if not items_list:
        session.state = STATE_ACTIVE
        db.commit()
        return [_send_text(
            channel, sender_id,
            f"{msg_prefix} Tu pedido está vacío. ¿Quieres pedir algo más?",
        )]

    cart_body = (
        f"{msg_prefix}\n\n"
        f"🛒 Tu pedido actualizado:\n{format_cart_summary(items_list)}\n\n"
        f"💰 Total: ${cart['total']}"
    )
    return [_send_cart_options(channel, sender_id, cart_body)]


# ── Remove from cart ──────────────────────────────────────────────────────────


def remove_from_cart(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
    item_id: int,
) -> list:
    cart: dict[str, Any] = dict(session.cart_data)
    items_list = list(cart.get("items", []))

    item_to_remove = next((it for it in items_list if it.get("id") == item_id), None)
    if not item_to_remove:
        return [_send_text(
            channel, sender_id,
            "Ese producto no está en tu pedido. ¿Quieres ver lo que tienes?",
        )]

    if item_to_remove["qty"] > 1:
        item_to_remove["qty"] -= 1
    else:
        items_list = [it for it in items_list if it.get("id") != item_id]

    cart["items"] = items_list
    cart["total"] = _recompute_total(items_list)

    if not items_list:
        session.state = STATE_ACTIVE
        cart.pop("confirm_step", None)
        session.cart_data = cart
        db.commit()
        return [_send_text(
            channel, sender_id,
            f"✅ {item_to_remove['name']} eliminado. "
            f"Tu pedido está vacío. ¿Quieres pedir algo más?",
        )]

    cart["confirm_step"] = STEP_CART_OPTIONS
    session.cart_data = cart
    session.state = STATE_CONFIRMING
    db.commit()

    cart_body = (
        f"✅ {item_to_remove['name']} eliminado de tu pedido.\n\n"
        f"🛒 Tu pedido actualizado:\n{format_cart_summary(items_list)}\n\n"
        f"💰 Total: ${cart['total']}"
    )
    return [_send_cart_options(channel, sender_id, cart_body)]


# ── Cancel order ──────────────────────────────────────────────────────────────


def cancel_order(
    db: Session,
    channel: str,
    sender_id: str,
    session: models.BotSession,
) -> list:
    cart: dict[str, Any] = dict(session.cart_data)
    cart["items"] = []
    cart["total"] = 0.0
    cart.pop("confirm_step", None)
    session.cart_data = cart
    session.state = STATE_ACTIVE
    db.commit()
    return [_send_text(
        channel, sender_id,
        "Pedido cancelado. ¡Cuando quieras volver a pedir, aquí estaremos! 😊",
    )]
