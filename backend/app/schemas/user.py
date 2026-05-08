import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Shared properties
VALID_ROLES = Literal["owner", "receptionist", "cook"]


def _password_strength(v: str) -> str:
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("La contraseña debe incluir al menos una letra y un número.")
    return v

class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: VALID_ROLES | None = "cook"
    is_active: bool | None = True
    kitchen_id: int | None = None

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
    email: EmailStr | None = None
    full_name: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _password_strength(v)


class UserSelfUpdate(BaseModel):
    """Solo perfil propio: sin role/email/is_active (evita escalada de privilegios)."""
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _password_strength(v)


class UserInDBBase(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

class OrganizationBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str

# Additional properties to return via API
class User(UserInDBBase):
    organization_id: int | None = None
    organizations: list[OrganizationBase] | None = []

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
