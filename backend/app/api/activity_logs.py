from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/")
def read_activity_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = Query(200, le=500),
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Any:
    """ Retrieve activity logs for the user's organization. """
    query = db.query(models.ActivityLog)\
              .filter(models.ActivityLog.organization_id == current_user.organization_id)

    if entity_type:
        query = query.filter(models.ActivityLog.entity_type == entity_type)
    if action:
        query = query.filter(models.ActivityLog.action == action)
    if user_id:
        query = query.filter(models.ActivityLog.user_id == user_id)

    logs = query.order_by(models.ActivityLog.created_at.desc())\
                .offset(skip).limit(limit).all()

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user_name,
            "user_role": log.user_role,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
