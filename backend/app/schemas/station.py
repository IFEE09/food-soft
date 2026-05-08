from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class StationBase(BaseModel):
    name: str
    is_active: bool = True
    kitchen_id: Optional[int] = None

class StationCreate(StationBase):
    pass

class StationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    kitchen_id: Optional[int] = None

class Station(StationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
