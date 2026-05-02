import logging
import secrets
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.db import models
from app.db.session import get_db
from app.core import security
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.activity import log_activity
from app.schemas.user import User as UserSchema, UserCreate

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> models.User:
    try:
        user_id = security.decode_access_token_subject(token)
    except security.InvalidAccessToken:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    return user


def require_roles(*roles: str):
    """ FastAPI dependency factory: ensure current user has one of the given roles. """
    def checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Permiso denegado. Requiere rol: {', '.join(roles)}."
            )
        return current_user
    return checker


def require_owner(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Acción restringida al propietario.")
    return current_user

router = APIRouter()

@router.post("/login")
@limiter.limit("30/minute")
def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, retrieve an access token for future requests
    """
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario o contraseña incorrectos",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    log_activity(
        db, user,
        action="login", entity_type="auth", entity_id=user.id,
        description=f"Inicio de sesión de {user.email}"
    )
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
        "organization_id": user.organization_id,
    }

@router.post("/register", response_model=UserSchema)
def register_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Register a new user. Default role is owner for this MVP.
    """
    if not settings.PUBLIC_REGISTRATION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El registro público está desactivado.",
        )
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con este correo electrónico.",
        )
    
    # Create organization for New Owner with Secure API Key
    new_org = models.Organization(
        name=f"Kitchen of {user_in.full_name}",
        api_key=secrets.token_urlsafe(32)
    )
    db.add(new_org)
    db.flush()

    new_user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=security.get_password_hash(user_in.password),
        role="owner",
        is_active=True,
        organization_id=new_org.id
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con este correo electrónico.",
        )
    except Exception:
        db.rollback()
        logger.exception("Error inesperado registrando usuario")
        raise HTTPException(status_code=500, detail="No se pudo completar el registro.")
    db.refresh(new_user)
    log_activity(
        db, new_user,
        action="create", entity_type="user", entity_id=new_user.id,
        description=f"Registro de nuevo usuario '{new_user.email}' ({new_user.role})"
    )
    return new_user
