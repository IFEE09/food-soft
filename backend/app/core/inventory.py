"""Descuenta insumos según recetas del menú al crear líneas de pedido.
También registra movimientos de inventario y envía alertas de stock bajo por WhatsApp.
"""
import logging
from collections.abc import Iterable

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db import models

logger = logging.getLogger(__name__)


# ── Alertas de stock bajo ─────────────────────────────────────────────────────

def _send_low_stock_alert(
    db: Session,
    supply: models.Supply,
    organization_id: int,
) -> None:
    """Envía un mensaje de WhatsApp al número del dueño cuando un insumo baja del mínimo."""
    try:
        org = db.query(models.Organization).filter(
            models.Organization.id == organization_id
        ).first()
        if not org or not org.whatsapp_phone_number_id:
            return

        # Buscar el usuario owner de la organización para obtener su número
        owner = db.query(models.User).filter(
            models.User.organization_id == organization_id,
            models.User.role == "owner",
            models.User.is_active,
        ).first()
        if not owner:
            return

        # Obtener el número del dueño desde BotCustomer (si alguna vez usó el bot)
        # o desde el campo phone del User si existiera. Por ahora usamos el teléfono
        # registrado en BotCustomer del owner.
        customer = db.query(models.BotCustomer).filter(
            models.BotCustomer.organization_id == organization_id,
            models.BotCustomer.channel == "whatsapp",
        ).first()
        if not customer:
            logger.warning(
                "[INVENTORY] No hay BotCustomer para org %s, no se puede enviar alerta de stock.",
                organization_id,
            )
            return

        from app.core.bot.meta_client import send_whatsapp_message

        pct = (supply.quantity / supply.min_quantity * 100) if supply.min_quantity > 0 else 0
        emoji = "🔴" if supply.quantity <= 0 else "🟡"
        msg_body = (
            f"{emoji} *ALERTA DE STOCK BAJO — {org.name}*\n\n"
            f"El insumo *{supply.name}* está por debajo del mínimo:\n"
            f"• Stock actual: *{round(supply.quantity, 2)} {supply.unit}*\n"
            f"• Mínimo configurado: *{supply.min_quantity} {supply.unit}*\n"
            f"• Nivel: *{round(pct, 1)}%*\n\n"
            f"Por favor recarga el inventario lo antes posible."
        )
        payload = {
            "messaging_product": "whatsapp",
            "to": customer.channel_user_id,
            "type": "text",
            "text": {"body": msg_body},
        }
        send_whatsapp_message(org.whatsapp_phone_number_id, payload)
        logger.info(
            "[INVENTORY] Alerta de stock bajo enviada para '%s' (org=%s, qty=%s, min=%s)",
            supply.name, organization_id, supply.quantity, supply.min_quantity,
        )
    except Exception:
        logger.exception("[INVENTORY] Error enviando alerta de stock bajo para supply_id=%s", supply.id)


# ── Función principal de descuento ────────────────────────────────────────────

def deduct_supplies_for_line_items(
    db: Session,
    organization_id: int | None,
    line_items: Iterable[tuple[str, int]],
    order_id: int | None = None,
) -> None:
    """
    Verifica disponibilidad y descuenta insumos según las recetas de los productos.
    Registra un SupplyMovement por cada insumo descontado.
    Si algún insumo queda por debajo de min_quantity, envía alerta de WhatsApp.
    Si el stock es insuficiente, lanza ValueError.
    """
    if organization_id is None:
        return

    # 1. Calcular totales requeridos para todo el pedido
    required_totals: dict[int, float] = {}  # supply_id -> delta_total

    for product_name, qty in line_items:
        if qty is None or qty <= 0:
            continue
        name = (product_name or "").strip()

        menu_item = db.query(models.MenuItem).filter(
            models.MenuItem.organization_id == organization_id,
            models.MenuItem.name == name,
        ).first()
        if not menu_item:
            continue

        recipes = db.query(models.MenuItemRecipe).filter(
            models.MenuItemRecipe.menu_item_id == menu_item.id
        ).all()

        for rec in recipes:
            delta = float(rec.quantity) * float(qty)
            if delta <= 0:
                continue
            required_totals[rec.supply_id] = required_totals.get(rec.supply_id, 0.0) + delta

    if not required_totals:
        return

    # 2. Verificar disponibilidad
    supplies = db.query(models.Supply).filter(
        models.Supply.id.in_(required_totals.keys()),
        models.Supply.organization_id == organization_id,
    ).all()
    supply_map = {s.id: s for s in supplies}

    for s_id, needed in required_totals.items():
        supply = supply_map.get(s_id)
        if not supply:
            continue
        if supply.quantity < needed:
            raise ValueError(
                f"Stock insuficiente para '{supply.name}'. "
                f"Necesario: {needed} {supply.unit}, "
                f"Disponible: {supply.quantity} {supply.unit}"
            )

    # 3. Descontar y registrar movimientos
    alerts_needed: list[models.Supply] = []

    for s_id, delta in required_totals.items():
        db.execute(
            update(models.Supply)
            .where(models.Supply.id == s_id)
            .values(quantity=models.Supply.quantity - delta)
        )
        # Registrar movimiento de salida
        movement = models.SupplyMovement(
            supply_id=s_id,
            organization_id=organization_id,
            movement_type="out",
            quantity=round(delta, 4),
            notes=f"Pedido #{order_id}" if order_id else "Pedido (bot)",
            order_id=order_id,
        )
        db.add(movement)

    db.flush()  # Aplicar los updates antes de leer los nuevos valores

    # 4. Detectar insumos que quedaron bajo el mínimo
    updated_supplies = db.query(models.Supply).filter(
        models.Supply.id.in_(required_totals.keys()),
        models.Supply.organization_id == organization_id,
    ).all()

    for supply in updated_supplies:
        if supply.min_quantity is not None and supply.quantity <= supply.min_quantity:
            alerts_needed.append(supply)

    # 5. Enviar alertas (después del commit, en background para no bloquear el pedido)
    for supply in alerts_needed:
        try:
            _send_low_stock_alert(db, supply, organization_id)
        except Exception:
            logger.exception("[INVENTORY] Fallo al enviar alerta para supply_id=%s", supply.id)
