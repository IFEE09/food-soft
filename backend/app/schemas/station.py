from pydantic import BaseModel, ConfigDict


class StationBase(BaseModel):
    name: str
    is_active: bool = True
    kitchen_id: int | None = None

class StationCreate(StationBase):
    pass

class StationUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    kitchen_id: int | None = None

class Station(StationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
