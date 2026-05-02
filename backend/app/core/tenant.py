from typing import TypeVar
from fastapi import HTTPException
from sqlalchemy.orm import DeclarativeBase, Session

from app.db import models

T = TypeVar("T", bound=DeclarativeBase)


def get_owned_or_404(
    db: Session,
    model: type[T],
    entity_id: int,
    current_user: models.User,
    not_found_detail: str = "Recurso no encontrado",
) -> T:
    """
    Fetch a record by id scoped to the current user's organization.
    Raises 404 if not found or not owned by the caller's org.
    """
    obj = db.query(model).filter(
        model.id == entity_id,
        model.organization_id == current_user.organization_id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return obj


def assert_supply_in_organization(
    db: Session,
    supply_id: int,
    organization_id: int | None,
    *,
    detail: str = "El insumo no pertenece a tu organización.",
) -> None:
    if organization_id is None:
        raise HTTPException(status_code=400, detail="Usuario sin organización asignada.")
    exists = (
        db.query(models.Supply)
        .filter(
            models.Supply.id == supply_id,
            models.Supply.organization_id == organization_id,
        )
        .first()
    )
    if not exists:
        raise HTTPException(status_code=400, detail=detail)


def assert_kitchen_in_organization(
    db: Session,
    kitchen_id: int | None,
    organization_id: int | None,
    *,
    detail: str = "La cocina no pertenece a tu organización.",
) -> None:
    if kitchen_id is None:
        return
    if organization_id is None:
        raise HTTPException(status_code=400, detail="Usuario sin organización asignada.")
    exists = (
        db.query(models.Kitchen)
        .filter(
            models.Kitchen.id == kitchen_id,
            models.Kitchen.organization_id == organization_id,
        )
        .first()
    )
    if not exists:
        raise HTTPException(status_code=400, detail=detail)
