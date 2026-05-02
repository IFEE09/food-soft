import secrets
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.api.auth import require_owner
from app.core.activity import log_activity
from app.core.api_keys import hash_api_key

router = APIRouter()


class WhatsAppPhoneBinding(BaseModel):
    """Valor exacto de `metadata.phone_number_id` del webhook de WhatsApp Cloud API."""
    whatsapp_phone_number_id: Optional[str] = Field(
        default=None,
        description="Cadena vacía o null desvincula.",
    )


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


@router.patch("/me/whatsapp")
def bind_whatsapp_phone_number_id(
    body: WhatsAppPhoneBinding,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
):
    """Vincula el número de WhatsApp Business (multi-tenant en webhook Meta)."""
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")

    raw = (body.whatsapp_phone_number_id or "").strip()
    if raw:
        taken = (
            db.query(models.Organization)
            .filter(
                models.Organization.whatsapp_phone_number_id == raw,
                models.Organization.id != org.id,
            )
            .first()
        )
        if taken:
            raise HTTPException(
                status_code=400,
                detail="Este phone_number_id ya está vinculado a otra organización.",
            )
        org.whatsapp_phone_number_id = raw
    else:
        org.whatsapp_phone_number_id = None

    db.add(org)
    db.commit()
    db.refresh(org)

    log_activity(
        db,
        current_user,
        action="update",
        entity_type="organization",
        entity_id=org.id,
        description="Actualizó vinculación WhatsApp (phone_number_id)",
    )
    return {"whatsapp_phone_number_id": org.whatsapp_phone_number_id}
