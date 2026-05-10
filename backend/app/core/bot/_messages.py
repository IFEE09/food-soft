"""
Message builders — adapter por canal + plantillas reutilizables.

Cada función devuelve un payload listo para enviar a la plataforma correspondiente.
NO tienen efectos sobre DB. Son puramente formatters.

API estable: las funciones reciben `channel` (str) y `to` (str) + el contenido.
Si añades un canal nuevo, solo extiendes `text()` y `image()`.
"""

from __future__ import annotations

from app.core.bot._formatters import clean_text
from app.core.bot.adapters import InstagramAdapter, MessengerAdapter, WhatsAppAdapter

# ── Adapter por canal ───────────────────────────────────────────────────────


def send_text_action(channel: str, to: str, body: str) -> dict:
    """Wrapper común para acción SEND_TEXT. Usar este en lugar de duplicar el dict.

    Devuelve `{"action": "SEND_TEXT", "payload": text(...)}`. Las funciones de
    `_actions`, `_orders_actions` y `_confirm` usaban esto duplicado.
    """
    return {"action": "SEND_TEXT", "payload": text(channel, to, body)}


def text(channel: str, to: str, body: str) -> dict:
    """Mensaje de texto. clean_text() quita markdown en canales que no lo soportan."""
    body = clean_text(channel, body)
    if channel == "whatsapp":
        return WhatsAppAdapter.format_text(to, body)
    if channel == "messenger":
        return MessengerAdapter.format_text(to, body)
    return InstagramAdapter.format_text(to, body)


def image(channel: str, to: str, image_url: str) -> dict:
    if channel == "whatsapp":
        return WhatsAppAdapter.format_image(to, image_url)
    if channel == "messenger":
        return MessengerAdapter.format_image(to, image_url)
    return InstagramAdapter.format_image(to, image_url)


# ── Plantillas con opciones numeradas (sin botones interactivos) ────────────


def cart_options_msg(channel: str, to: str, cart_body: str) -> dict:
    """Mensaje post-carrito con 3 opciones numeradas (1/2/3)."""
    body = (
        f"{cart_body}\n\n"
        f"¿Qué deseas hacer?\n"
        f"1️⃣ Confirmar pedido\n"
        f"2️⃣ Agregar notas (sin cebolla, extra queso...)\n"
        f"3️⃣ Agregar / quitar productos"
    )
    return text(channel, to, body)


def yes_no_msg(channel: str, to: str, body: str) -> dict:
    """Mensaje con opciones Sí/No numeradas."""
    return text(channel, to, f"{body}\n\n1️⃣ Sí, confirmar\n2️⃣ No, cambiar datos")


def name_confirm_msg(channel: str, to: str, saved_name: str) -> dict:
    return text(channel, to, (
        f"¿Tu nombre sigue siendo *{saved_name}*?\n\n"
        f"1️⃣ Sí, ese es mi nombre\n"
        f"2️⃣ Cambiar nombre"
    ))


def address_confirm_msg(channel: str, to: str, saved_address: str) -> dict:
    return text(channel, to, (
        f"¿Enviamos a *{saved_address}*?\n\n"
        f"1️⃣ Sí, esa dirección\n"
        f"2️⃣ Cambiar dirección"
    ))


def unrecognized_option(channel: str, to: str, options_text: str) -> list:
    """Responde 'Opción no reconocida' + reenvía las opciones disponibles."""
    msg = f"⚠️ Opción no reconocida. Por favor elige una de las siguientes:\n\n{options_text}"
    return [{"action": "SEND_TEXT", "payload": text(channel, to, msg)}]


# ── Helpers del patrón confirm-before-commit ────────────────────────────────


def confirm_item_msg(channel: str, to: str, item_name: str, price: float, item_note: str | None = None) -> dict:
    """Propone un item al cliente antes de agregarlo al carrito.

    Formato:
        Entendí: Peperoni Grande — $149.0. ¿Confirmas?
        1 Sí, agrégalo
        2 No, era otra cosa
    """
    note_str = f" (\u270e {item_note})" if item_note else ""
    body = (
        f"Entendí: *{item_name}*{note_str} \u2014 ${price:.0f}. ¿Confirmas?\n\n"
        f"1️⃣ Sí, agrégalo\n"
        f"2️⃣ No, era otra cosa"
    )
    return text(channel, to, body)


def unrecognized_item_msg(channel: str, to: str) -> dict:
    """Mensaje canónico cuando el bot no identificó el producto con confianza suficiente."""
    body = (
        "Disculpa, no entendí bien 😅 "
        "¿Me dices el nombre del producto otra vez? "
        "También puedes escribir *menú* para ver las opciones."
    )
    return text(channel, to, body)


def propose_variant_msg(channel: str, to: str, base_name: str, options: list[dict]) -> dict:
    """Pregunta la variante (Grande/Familiar) con precios exactos.

    `options` es una lista de dicts con keys: id, label, price.
    Ejemplo: [{"id": 12, "label": "Grande", "price": 289}, {"id": 13, "label": "Familiar", "price": 319}]
    """
    opts_lines = "\n".join(f"*{o['label']}* (${o['price']:.0f})" for o in options)
    body = f"¿Cómo la quieres?\n{opts_lines}"
    return text(channel, to, body)
