from typing import Optional
from sqlalchemy.orm import Session
from app.db import models


def log_activity(
    db: Session,
    user: Optional[models.User],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    description: Optional[str] = None,
    organization_id: Optional[int] = None,
) -> None:
    """
    Registra una actividad en el sistema. Nunca lanza excepción,
    para no romper la operación principal si el log falla.
    """
    try:
        org_id = organization_id if organization_id is not None else (user.organization_id if user else None)
        entry = models.ActivityLog(
            organization_id=org_id,
            user_id=user.id if user else None,
            user_name=(user.full_name if user else None) or (user.email if user else None),
            user_role=user.role if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
        db.add(entry)
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
