from typing import Optional
from pydantic import BaseModel

# Shared properties
class SupplyBase(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "pz"
    min_quantity: Optional[float] = 5.0
    category: Optional[str] = None

# Properties to receive via API on creation
class SupplyCreate(SupplyBase):
    name: str

# Properties to receive via API on update
class SupplyUpdate(SupplyBase):
    pass

class SupplyInDBBase(SupplyBase):
    id: int

    class Config:
        from_attributes = True

# Additional properties to return via API
class Supply(SupplyInDBBase):
    pass
