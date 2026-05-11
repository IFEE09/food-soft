
from pydantic import BaseModel, ConfigDict

from .supply import Supply


class RecipeItemBase(BaseModel):
    supply_id: int
    quantity: float

class RecipeItemCreate(RecipeItemBase):
    pass

class RecipeItem(RecipeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_item_id: int
    supply: Supply | None = None

class MenuItemBase(BaseModel):
    name: str
    price: float = 0.0
    category: str | None = None
    description: str | None = None
    station_id: int | None = None  # KDS: estación responsable de preparar este platillo

class MenuItemCreate(MenuItemBase):
    recipe_items: list[RecipeItemCreate] = []

class MenuItemUpdate(MenuItemBase):
    name: str | None = None
    price: float | None = None
    station_id: int | None = None
    recipe_items: list[RecipeItemCreate] | None = None

class MenuItem(MenuItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_id: int | None = None
    recipe_items: list[RecipeItem] = []
