from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class KitchenBase(BaseModel):
    name: str
    address: Optional[str] = None
    is_active: bool = True

class KitchenCreate(KitchenBase):
    pass

class KitchenUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class Kitchen(KitchenBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
