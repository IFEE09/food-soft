"""
Formatters — funciones puras (sin DB ni side effects).

Una función pura es testeable sola, reusable en cualquier contexto y se mantiene
estable a través de refactors. Si pones lógica de DB aquí, deja de ser pura.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal


def round_price(value: float) -> float:
    """Redondea a 2 decimales sin errores de float (0.1 + 0.2 == 0.30, no 0.30000004)."""
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def format_cart_summary(items_list: list) -> str:
    """Renderiza el resumen del carrito como bloque de texto: '1x Producto — $precio'."""
    lines = []
    for it in items_list:
        qty = it.get('qty', 1)
        line = f"{qty}x {it['name']} — ${round_price(it['price'] * qty)}"
        if it.get("note"):
            line += f"\n   ✎ {it['note']}"
        lines.append(line)
    return "\n".join(lines)


def clean_text(channel: str, text: str) -> str:
    """Quita marcadores `*texto*` (Markdown bold) en canales que no los renderizan
    (Messenger e Instagram no soportan formato; WhatsApp sí).
    """
    if channel in ("messenger", "instagram", "facebook"):
        text = re.sub(r"\*+(.*?)\*+", r"\1", text)
    return text
