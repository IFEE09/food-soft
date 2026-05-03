from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class InvalidAccessToken(Exception):
    """Token JWT ausente, inválido o expirado."""


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject), "typ": "access"}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "typ": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token_subject(token: str) -> int:
    """Extrae el user id del JWT; lanza InvalidAccessToken si falla."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        sub = payload.get("sub")
        if sub is None:
            raise InvalidAccessToken("Token sin subject")
        if payload.get("typ") == "refresh":
            raise InvalidAccessToken("Usar refresh solo en /auth/refresh")
        return int(sub)
    except (JWTError, ValueError, TypeError) as e:
        raise InvalidAccessToken(str(e)) from e


def decode_refresh_token_subject(token: str) -> int:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        if payload.get("typ") != "refresh":
            raise InvalidAccessToken("No es un refresh token")
        sub = payload.get("sub")
        if sub is None:
            raise InvalidAccessToken("Token sin subject")
        return int(sub)
    except (JWTError, ValueError, TypeError) as e:
        raise InvalidAccessToken(str(e)) from e


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
