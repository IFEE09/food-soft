from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal

# Shared properties
VALID_ROLES = Literal["owner", "receptionist", "cook"]

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[VALID_ROLES] = "cook"
    is_active: Optional[bool] = True

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: VALID_ROLES = "cook"

class UserUpdate(UserBase):
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

class UserInDBBase(UserBase):
    id: int

    class Config:
        from_attributes = True

# Additional properties to return via API
class User(UserInDBBase):
    pass

# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str

class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
