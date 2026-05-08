from pydantic import BaseModel, ConfigDict


class KitchenBase(BaseModel):
    name: str
    address: str | None = None
    is_active: bool = True

class KitchenCreate(KitchenBase):
    pass

class KitchenUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    is_active: bool | None = None

class Kitchen(KitchenBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
