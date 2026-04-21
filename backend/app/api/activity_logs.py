from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.api.auth import require_owner
from app.schemas import activity as activity_schema

router = APIRouter()

@router.get("/", response_model=List[activity_schema.ActivityLog])
def read_activity_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
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

    return logs
