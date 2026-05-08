"""
Menu cache — capa fina sobre `app.core.cache` con keys e invalidación coordinadas.

Diseño durable:
- Keys derivadas (NUNCA hardcodear strings en callers).
- Invalidación explícita en CUALQUIER mutación de menu/promotions.
- Tipos: serialización vía `_serialize_*` para no acoplar a SQLAlchemy.

Uso típico:

    from app.core.menu_cache import get_menu_for_org, invalidate_menu

    items = get_menu_for_org(db, organization_id=org_id)   # cached
    # tras crear/actualizar/borrar un MenuItem:
    invalidate_menu(organization_id=org_id)

INVARIANTE: cualquier código que haga `db.query(MenuItem).filter_by(organization_id=X)`
debe migrarse a este helper para que se beneficie del cache.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.cache import get_cache
from app.core.config import settings
from app.db import models


# ── Keys ─────────────────────────────────────────────────────────────────────
def _menu_key(org_id: int) -> str:
    return f"menu:org:{org_id}:items"


def _promos_key(org_id: int) -> str:
    return f"menu:org:{org_id}:promotions"


# ── Serialización (independiente de SQLAlchemy) ─────────────────────────────
def _serialize_menu_item(item: models.MenuItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "price": float(item.price) if item.price is not None else 0.0,
        "category": item.category,
        "description": item.description,
        "organization_id": item.organization_id,
    }


def _serialize_promotion(promo: Any) -> dict[str, Any]:
    return {
        "id": promo.id,
        "name": getattr(promo, "name", None),
        "description": getattr(promo, "description", None),
        "is_active": getattr(promo, "is_active", False),
        "organization_id": getattr(promo, "organization_id", None),
    }


# ── API pública ─────────────────────────────────────────────────────────────
def get_menu_for_org(db: Session, organization_id: int) -> list[dict[str, Any]]:
    """Lista de menu items dict-serializados. Cache TTL desde settings.CACHE_TTL_SECONDS."""
    cache = get_cache()
    key = _menu_key(organization_id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    items = (
        db.query(models.MenuItem)
        .filter_by(organization_id=organization_id)
        .all()
    )
    payload = [_serialize_menu_item(i) for i in items]
    cache.set(key, payload, ttl_seconds=settings.CACHE_TTL_SECONDS)
    return payload


def get_active_promotions_for_org(db: Session, organization_id: int) -> list[dict[str, Any]]:
    cache = get_cache()
    key = _promos_key(organization_id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    promos = (
        db.query(models.Promotion)
        .filter_by(organization_id=organization_id, is_active=True)
        .all()
    )
    payload = [_serialize_promotion(p) for p in promos]
    cache.set(key, payload, ttl_seconds=settings.CACHE_TTL_SECONDS)
    return payload


def invalidate_menu(organization_id: int) -> None:
    """Llamar tras CUALQUIER mutación de menu_items para esta org."""
    get_cache().delete(_menu_key(organization_id))


def invalidate_promotions(organization_id: int) -> None:
    """Llamar tras CUALQUIER mutación de promotions para esta org."""
    get_cache().delete(_promos_key(organization_id))
