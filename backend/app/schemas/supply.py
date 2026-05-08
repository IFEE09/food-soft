from typing import Optional
from pydantic import BaseModel, ConfigDict

# Shared properties
class SupplyBase(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "pz"
    cost: Optional[float] = 0.0
    min_quantity: Optional[float] = 5.0
    category: Optional[str] = None
    kitchen_id: Optional[int] = None

# Properties to receive via API on creation
class SupplyCreate(SupplyBase):
    name: str

# Properties to receive via API on update
class SupplyUpdate(SupplyBase):
    pass

class SupplyInDBBase(SupplyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

# Additional properties to return via API
class Supply(SupplyInDBBase):
    pass
