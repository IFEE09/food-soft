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
