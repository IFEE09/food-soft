import re
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

# Shared properties
VALID_ROLES = Literal["owner", "receptionist", "cook"]


def _password_strength(v: str) -> str:
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("La contraseña debe incluir al menos una letra y un número.")
    return v

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[VALID_ROLES] = "cook"
    is_active: Optional[bool] = True
    kitchen_id: Optional[int] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: VALID_ROLES = "cook"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _password_strength(v)


class UserUpdate(BaseModel):
    """No hereda UserBase: sin `role` (evita escalada si se usa en endpoints)."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _password_strength(v)


class UserSelfUpdate(BaseModel):
    """Solo perfil propio: sin role/email/is_active (evita escalada de privilegios)."""
    full_name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _password_strength(v)


class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True

class OrganizationBase(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

# Additional properties to return via API
class User(UserInDBBase):
    organization_id: Optional[int] = None
    organizations: Optional[list[OrganizationBase]] = []

# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str

class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _password_strength(v)
