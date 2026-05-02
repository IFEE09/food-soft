"""Descuenta insumos según recetas del menú al crear líneas de pedido."""
from typing import Iterable, Tuple

from sqlalchemy.orm import Session

from app.db import models


def deduct_supplies_for_line_items(
    db: Session,
    organization_id: int | None,
    line_items: Iterable[Tuple[str, int]],
) -> None:
    """
    Por cada línea, si existe un MenuItem con el mismo nombre en la org,
    resta rec.quantity * línea.cantidad de cada Supply vinculado.
    Si no hay platillo o receta, no hace nada (línea libre / texto manual).
    """
    if organization_id is None:
        return

    for product_name, qty in line_items:
        if qty is None or qty <= 0:
            continue
        name = (product_name or "").strip()
        if not name:
            continue

        menu_item = (
            db.query(models.MenuItem)
            .filter(
                models.MenuItem.organization_id == organization_id,
                models.MenuItem.name == name,
            )
            .first()
        )
        if not menu_item:
            continue

        recipes = (
            db.query(models.MenuItemRecipe)
            .filter(models.MenuItemRecipe.menu_item_id == menu_item.id)
            .all()
        )
        for rec in recipes:
            supply = (
                db.query(models.Supply)
                .filter(
                    models.Supply.id == rec.supply_id,
                    models.Supply.organization_id == organization_id,
                )
                .first()
            )
            if not supply:
                continue
            supply.quantity -= float(rec.quantity) * float(qty)
            db.add(supply)
