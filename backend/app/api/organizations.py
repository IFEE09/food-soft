import secrets
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.api.auth import require_owner
from app.core.activity import log_activity
from app.core.api_keys import hash_api_key

router = APIRouter()

@router.get("/me")
def get_my_organization(
    current_user: models.User = Depends(require_owner),
) -> Any:
    return current_user.organization

@router.post("/api-key/rotate")
def rotate_api_key(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
) -> Any:
    """ Rotates the organization's API key for integrations. """
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    
    new_key = secrets.token_urlsafe(32)
    org.api_key_hash = hash_api_key(new_key)
    org.api_key = None
    db.add(org)
    db.commit()
    db.refresh(org)
    
    log_activity(
        db, current_user,
        action="update", entity_type="organization", entity_id=org.id,
        description="Rotó la llave de API de integración"
    )
    
    return {"api_key": new_key}
