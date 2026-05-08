"""
Tenant guard — defensa en profundidad para multi-tenant.

PROBLEMA: cualquier query a tablas con `organization_id` que olvide filtrarlo es un
data leak entre tenants. Hay docenas de queries: humanamente imposible auditar siempre.

SOLUCIÓN (durable, sin reescribir todo):
1. Decorador `with_tenant(model, organization_id)` para query builders.
2. Test suite cross-tenant que verifica que org A nunca ve datos de org B.
3. (Opcional, prod-grade) Postgres Row-Level Security: la DB rechaza la query.

Este módulo cubre (1) y expone helpers para (2). RLS se documenta en README.

API:
    from app.core.tenant_guard import scoped_query

    items = scoped_query(db, models.MenuItem, organization_id=org_id).all()

INVARIANTE: si un model tiene atributo `organization_id`, scoped_query SIEMPRE
añade el filter. Si no lo tiene, lanza ValueError (fail-fast: te dice qué pasó).
"""

from __future__ import annotations

from typing import Any, TypeVar

from sqlalchemy.orm import DeclarativeBase, Query, Session

T = TypeVar("T", bound=DeclarativeBase)


def has_org_column(model: type) -> bool:
    """True si el model tiene `organization_id` (i.e. es tenant-scoped)."""
    return hasattr(model, "organization_id")


def scoped_query(
    db: Session,
    model: type[T],
    *,
    organization_id: int | None,
) -> Query[Any]:
    """Query base con filtro de tenant aplicado.

    - Si el model NO tiene `organization_id` → ValueError (fail-fast en dev).
    - Si `organization_id` es None → ValueError (no permitir queries cross-tenant accidentales).

    Usar:
        scoped_query(db, models.MenuItem, organization_id=user.organization_id).filter(...)
    """
    if not has_org_column(model):
        raise ValueError(
            f"{model.__name__} no tiene `organization_id`; usar db.query() directamente."
        )
    if organization_id is None:
        raise ValueError(
            f"organization_id requerido para {model.__name__}.scoped_query"
        )
    return db.query(model).filter(model.organization_id == organization_id)
