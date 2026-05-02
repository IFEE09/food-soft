from typing import Annotated, Any, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.api.auth import require_owner
from app.schemas import activity as activity_schema

router = APIRouter()

@router.get("/", response_model=List[activity_schema.ActivityLog])
def read_activity_logs(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(require_owner)],
    skip: int = 0,
    limit: Annotated[int, Query(le=500)] = 200,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Any:
    """ Retrieve activity logs for the user's organization. """
    logs_query = db.query(models.ActivityLog)\
              .filter(models.ActivityLog.organization_id == current_user.organization_id)

    if entity_type:
        logs_query = logs_query.filter(models.ActivityLog.entity_type == entity_type)
    if action:
        logs_query = logs_query.filter(models.ActivityLog.action == action)
    if user_id is not None:
        logs_query = logs_query.filter(models.ActivityLog.user_id == user_id)

    logs = logs_query.order_by(models.ActivityLog.created_at.desc())\
                .offset(skip).limit(limit).all()

    return logs
