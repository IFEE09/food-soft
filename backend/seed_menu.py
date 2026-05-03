from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models

def seed_menu():
    db = SessionLocal()
    try:
        # 1. Asegurar Organización
        org = db.query(models.Organization).filter(models.Organization.name == "Horno 74").first()
        if not org:
            org = models.Organization(name="Horno 74")
            db.add(org)
            db.commit()
            db.refresh(org)
        
        org_id = org.id

        # 2. Asegurar Estación (Kitchen)
        kitchen = db.query(models.Kitchen).filter(
            models.Kitchen.name == "Horno",
            models.Kitchen.organization_id == org_id
        ).first()
        if not kitchen:
            kitchen = models.Kitchen(name="Horno", organization_id=org_id)
            db.add(kitchen)
            db.commit()

        # 3. Cargar Insumos (Supplies)
        supplies_data = [
            {"name": "Masa de Pizza (bollo)", "unit": "pz", "quantity": 100, "cost": 5.0},
            {"name": "Queso Mozzarella", "unit": "kg", "quantity": 50, "cost": 120.0},
            {"name": "Peperoni", "unit": "kg", "quantity": 10, "cost": 180.0},
            {"name": "Salsa de Tomate", "unit": "kg", "quantity": 30, "cost": 45.0},
            {"name": "Jamón", "unit": "kg", "quantity": 15, "cost": 95.0},
            {"name": "Piña en almíbar", "unit": "kg", "quantity": 10, "cost": 60.0},
            {"name": "Tocino", "unit": "kg", "quantity": 12, "cost": 210.0},
            {"name": "Salami", "unit": "kg", "quantity": 8, "cost": 160.0},
            {"name": "Champiñones", "unit": "kg", "quantity": 5, "cost": 85.0},
            {"name": "Cebolla", "unit": "kg", "quantity": 10, "cost": 25.0},
            {"name": "Pimiento Verde", "unit": "kg", "quantity": 5, "cost": 40.0},
        ]
        
        supply_map = {}
        for s in supplies_data:
            existing = db.query(models.Supply).filter_by(name=s["name"], organization_id=org_id).first()
            if not existing:
                existing = models.Supply(**s, organization_id=org_id)
                db.add(existing)
                db.flush()
            supply_map[s["name"]] = existing.id

        # 4. Limpiar menú anterior para evitar duplicados
        db.query(models.MenuItem).filter(models.MenuItem.organization_id == org_id).delete()
        db.commit()

        menu_data = [
            # ENTRADAS
            {"name": "Peperoni Bites", "price": 79.00, "category": "Entradas", "description": "Bocadillos de peperoni"},
            {"name": "Pan con Ajo y Queso", "price": 125.00, "category": "Entradas", "description": "Clásico pan de ajo con queso fundido"},
            
            # PIZZAS TRADICIONALES
            {"name": "Peperoni Grande", "price": 149.00, "category": "Pizzas Tradicionales", "description": "Base de tomate, queso y peperoni"},
            {"name": "Peperoni Familiar", "price": 169.00, "category": "Pizzas Tradicionales", "description": "Base de tomate, queso y peperoni"},
            {"name": "Ohana Hawaiana Grande", "price": 189.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, piña y tocino"},
            {"name": "Ohana Hawaiana Familiar", "price": 219.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, piña y tocino"},
            
            # PIZZAS ESPECIALES
            {"name": "Cuatro Quesos Grande", "price": 249.00, "category": "Pizzas Especiales", "description": "Base de tomate, queso manchego, mozzarella, parmesano y roquefort"},
            {"name": "Suprema 74 Grande", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, jamón, salami, champiñones, cebolla y pimientos"},
        ]

        for item in menu_data:
            new_item = models.MenuItem(**item, organization_id=org_id)
            db.add(new_item)
            db.flush()

            # Agregar Receta Básica (Ejemplo Peperoni)
            if "Peperoni" in item["name"]:
                # 1 masa, 0.2kg queso, 0.1kg salsa, 0.08kg peperoni
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Masa de Pizza (bollo)"], quantity=1))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Queso Mozzarella"], quantity=0.200))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Salsa de Tomate"], quantity=0.100))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Peperoni"], quantity=0.080))
            
            elif "Hawaiana" in item["name"]:
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Masa de Pizza (bollo)"], quantity=1))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Queso Mozzarella"], quantity=0.200))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Salsa de Tomate"], quantity=0.100))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Jamón"], quantity=0.100))
                db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Piña en almíbar"], quantity=0.080))
        
        db.commit()
        print(f"✅ Menú e Inventario de Horno 74 cargados con éxito.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error cargando el menú: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_menu()

