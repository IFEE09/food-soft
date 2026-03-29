from typing import List, Optional
from pydantic import BaseModel

class KitchenBase(BaseModel):
    name: str
    is_active: bool = True

class KitchenCreate(KitchenBase):
    pass

class KitchenUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class Kitchen(KitchenBase):
    id: int

    class Config:
        from_attributes = True
