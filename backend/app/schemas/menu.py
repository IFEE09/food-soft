from typing import List, Optional
from pydantic import BaseModel
from .supply import Supply

class RecipeItemBase(BaseModel):
    supply_id: int
    quantity: float

class RecipeItemCreate(RecipeItemBase):
    pass

class RecipeItem(RecipeItemBase):
    id: int
    menu_item_id: int
    supply: Optional[Supply] = None

    class Config:
        from_attributes = True

class MenuItemBase(BaseModel):
    name: str
    price: float = 0.0
    category: Optional[str] = None
    description: Optional[str] = None

class MenuItemCreate(MenuItemBase):
    recipe_items: List[RecipeItemCreate] = []

class MenuItemUpdate(MenuItemBase):
    name: Optional[str] = None
    price: Optional[float] = None
    recipe_items: Optional[List[RecipeItemCreate]] = None

class MenuItem(MenuItemBase):
    id: int
    recipe_items: List[RecipeItem] = []

    class Config:
        from_attributes = True
