from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SupplyMovementCreate(BaseModel):
    supply_id: int
    movement_type: str = "in"   # in | out | adjust
    quantity: float
    notes: str | None = None


class SupplyMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supply_id: int
    organization_id: int | None
    movement_type: str
    quantity: float
    notes: str | None
    user_id: int | None
    order_id: int | None
    created_at: datetime

    # Campos enriquecidos (se rellenan en el endpoint)
    supply_name: str | None = None
    supply_unit: str | None = None
    user_name: str | None = None
