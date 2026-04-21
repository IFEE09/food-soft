from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db import models
from app.schemas import user as user_schema
from app.core import security
from app.api.auth import get_current_user
from app.core.activity import log_activity

router = APIRouter()

@router.get("/me", response_model=user_schema.User)
def read_user_me(
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """ Get current user. """
    return current_user

@router.put("/me", response_model=user_schema.User)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    user_in: user_schema.UserUpdate,
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """ Update own profile. """
    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data:
        hashed_password = security.get_password_hash(update_data["password"])
        del update_data["password"]
        current_user.hashed_password = hashed_password
    
    for field in update_data:
        setattr(current_user, field, update_data[field])
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    changed = ", ".join(update_data.keys()) if update_data else "contraseña"
    log_activity(
        db, current_user,
        action="update", entity_type="user", entity_id=current_user.id,
        description=f"Actualizó su perfil (campos: {changed})"
    )
    return current_user

@router.post("/me/change-password")
def change_password(
    *,
    db: Session = Depends(get_db),
    password_in: user_schema.ChangePassword,
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """ Change password with current password verification. """
    if not security.verify_password(password_in.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta.")
    
    current_user.hashed_password = security.get_password_hash(password_in.new_password)
    db.add(current_user)
    db.commit()
    log_activity(
        db, current_user,
        action="update", entity_type="user", entity_id=current_user.id,
        description="Cambió su contraseña"
    )
    return {"message": "Contraseña actualizada correctamente"}
