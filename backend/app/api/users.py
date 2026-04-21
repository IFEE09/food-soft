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

@router.get("/team", response_model=list[user_schema.User])
def list_team_members(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Any:
    """ List all users in the current user's organization. """
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede ver el equipo.")
    users = db.query(models.User).filter(
        models.User.organization_id == current_user.organization_id
    ).all()
    return users

@router.post("/team", response_model=user_schema.User)
def create_team_member(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    user_in: user_schema.UserCreate,
) -> Any:
    """ Owner creates a team member (receptionist or cook) in their organization. """
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede crear miembros de equipo.")
    if user_in.role == "owner":
        raise HTTPException(status_code=400, detail="No puedes crear otro propietario.")
    
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este correo.")
    
    new_user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=security.get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
        organization_id=current_user.organization_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_activity(
        db, current_user,
        action="create", entity_type="user", entity_id=new_user.id,
        description=f"Creó miembro de equipo '{new_user.full_name}' ({new_user.role})"
    )
    return new_user

@router.delete("/team/{user_id}")
def delete_team_member(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    user_id: int,
) -> Any:
    """ Owner deletes a team member from their organization. """
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Solo el propietario puede eliminar miembros.")
    
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.organization_id == current_user.organization_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo.")
    
    deleted_name = user.full_name
    deleted_role = user.role
    db.delete(user)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="user", entity_id=user_id,
        description=f"Eliminó miembro '{deleted_name}' ({deleted_role})"
    )
    return {"message": f"Usuario '{deleted_name}' eliminado correctamente."}

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
