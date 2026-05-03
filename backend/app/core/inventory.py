"""Descuenta insumos según recetas del menú al crear líneas de pedido."""
from typing import Iterable, Tuple

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db import models


def deduct_supplies_for_line_items(
    db: Session,
    organization_id: int | None,
    line_items: Iterable[Tuple[str, int]],
) -> None:
    """
    Checks availability and deducts supplies based on recipes.
    If any supply is insufficient, raises ValueError.
    """
    if organization_id is None:
        return

    # 1. Calculate total required supplies for the entire order
    required_totals = {}  # supply_id -> total_delta
    
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

    # 2. Verify availability
    supplies = db.query(models.Supply).filter(
        models.Supply.id.in_(required_totals.keys()),
        models.Supply.organization_id == organization_id
    ).all()
    
    supply_map = {s.id: s for s in supplies}
    
    for s_id, needed in required_totals.items():
        supply = supply_map.get(s_id)
        if not supply:
            continue
        if supply.quantity < needed:
            raise ValueError(f"Stock insuficiente para '{supply.name}'. Necesario: {needed}{supply.unit}, Disponible: {supply.quantity}{supply.unit}")

    # 3. Deduct if all checks passed
    for s_id, delta in required_totals.items():
        db.execute(
            update(models.Supply)
            .where(models.Supply.id == s_id)
            .values(quantity=models.Supply.quantity - delta)
        )
