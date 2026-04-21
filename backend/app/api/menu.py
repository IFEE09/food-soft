from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db import models
from app.schemas import menu as menu_schemas
from app.api.auth import get_current_user, require_owner
from app.core.activity import log_activity
from app.core.tenant import get_owned_or_404

router = APIRouter()

@router.get("/", response_model=List[menu_schemas.MenuItem])
def read_menu_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
) -> Any:
    """
    Retrieve all dishes for current organization.
    """
    return db.query(models.MenuItem)\
             .filter(models.MenuItem.organization_id == current_user.organization_id)\
             .all()

@router.post("/", response_model=menu_schemas.MenuItem)
def create_menu_item(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    item_in: menu_schemas.MenuItemCreate,
) -> Any:
    """
    Create a new dish with its recipe.
    """
    new_item = models.MenuItem(
        name=item_in.name,
        price=item_in.price,
        category=item_in.category,
        description=item_in.description,
        organization_id=current_user.organization_id
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
    log_activity(
        db, current_user,
        action="create", entity_type="menu_item", entity_id=new_item.id,
        description=f"Creó platillo '{new_item.name}' (${new_item.price})"
    )
    return new_item

@router.put("/{item_id}", response_model=menu_schemas.MenuItem)
def update_menu_item(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    item_id: int,
    item_in: menu_schemas.MenuItemUpdate,
) -> Any:
    """
    Update a dish.
    """
    db_item = get_owned_or_404(db, models.MenuItem, item_id, current_user, "Item not found")

    update_data = item_in.model_dump(exclude_unset=True)
    if "recipe_items" in update_data:
        # Complex logic: Remove old ones and add new ones
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
    log_activity(
        db, current_user,
        action="update", entity_type="menu_item", entity_id=db_item.id,
        description=f"Actualizó platillo '{db_item.name}'"
    )
    return db_item

@router.delete("/{item_id}", response_model=menu_schemas.MenuItem)
def delete_menu_item(
    *,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner),
    item_id: int,
) -> Any:
    """
    Delete a dish.
    """
    db_item = get_owned_or_404(db, models.MenuItem, item_id, current_user, "Item not found")
    deleted_name = db_item.name
    deleted_id = db_item.id
    db.delete(db_item)
    db.commit()
    log_activity(
        db, current_user,
        action="delete", entity_type="menu_item", entity_id=deleted_id,
        description=f"Eliminó platillo '{deleted_name}'"
    )
    return db_item
