
from pydantic import BaseModel, ConfigDict


# Shared properties
class SupplyBase(BaseModel):
    name: str | None = None
    quantity: float | None = 0.0
    unit: str | None = "pz"
    cost: float | None = 0.0
    min_quantity: float | None = 5.0
    category: str | None = None
    kitchen_id: int | None = None

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
