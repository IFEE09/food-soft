from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.schemas import menu as menu_schemas

router = APIRouter()

@router.get("/", response_model=List[menu_schemas.MenuItem])
def read_menu_items(db: Session = Depends(get_db)) -> Any:
    """
    Retrieve all dishes.
    """
    return db.query(models.MenuItem).all()

@router.post("/", response_model=menu_schemas.MenuItem)
def create_menu_item(
    *,
    db: Session = Depends(get_db),
    item_in: menu_schemas.MenuItemCreate,
) -> Any:
    """
    Create a new dish with its recipe.
    """
    new_item = models.MenuItem(
        name=item_in.name,
        price=item_in.price,
        category=item_in.category,
        description=item_in.description
    )
    db.add(new_item)
    db.flush() # To get ID

    # Add recipe items
    for recipe_in in item_in.recipe_items:
        recipe_entry = models.MenuItemRecipe(
            menu_item_id=new_item.id,
            supply_id=recipe_in.supply_id,
            quantity=recipe_in.quantity
        )
        db.add(recipe_entry)
    
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/{item_id}", response_model=menu_schemas.MenuItem)
def update_menu_item(
    *,
    db: Session = Depends(get_db),
    item_id: int,
    item_in: menu_schemas.MenuItemUpdate,
) -> Any:
    """
    Update a dish. (For simplicity, this example just updates basic info, can be extended for recipes)
    """
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = item_in.model_dump(exclude_unset=True)
    if "recipe_items" in update_data:
        # Complex logic: Remove old ones and add new ones (standard way)
        db.query(models.MenuItemRecipe).filter(models.MenuItemRecipe.menu_item_id == item_id).delete()
        for recipe_in in item_in.recipe_items:
            recipe_entry = models.MenuItemRecipe(
                menu_item_id=item_id,
                supply_id=recipe_in.supply_id,
                quantity=recipe_in.quantity
            )
            db.add(recipe_entry)
        del update_data["recipe_items"]

    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}", response_model=menu_schemas.MenuItem)
def delete_menu_item(
    *,
    db: Session = Depends(get_db),
    item_id: int,
) -> Any:
    """
    Delete a dish.
    """
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return db_item
