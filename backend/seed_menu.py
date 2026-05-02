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

        # 3. Limpiar menú anterior para evitar duplicados en pruebas
        db.query(models.MenuItem).filter(models.MenuItem.organization_id == org_id).delete()
        db.commit()

        menu_data = [
            # ENTRADAS
            {"name": "Peperoni Bites", "price": 79.00, "category": "Entradas", "description": "Bocadillos de peperoni"},
            {"name": "Pan con Ajo y Queso", "price": 125.00, "category": "Entradas", "description": "Clásico pan de ajo con queso fundido"},
            {"name": "Cheese Bread", "price": 125.00, "category": "Entradas", "description": "Pan suave con mezcla de quesos"},
            {"name": "Calzone", "price": 149.00, "category": "Entradas", "description": "Calzone relleno"},
            {"name": "Dip de Espinaca y Tocino", "price": 149.00, "category": "Entradas", "description": "Dip cremoso con espinaca y tocino crujiente"},

            # PIZZAS TRADICIONALES
            {"name": "Doble Queso Grande", "price": 149.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y doble queso"},
            {"name": "Doble Queso Familiar", "price": 169.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y doble queso"},
            
            {"name": "Peperoni Grande", "price": 149.00, "category": "Pizzas Tradicionales", "description": "Base de tomate, queso y peperoni"},
            {"name": "Peperoni Familiar", "price": 169.00, "category": "Pizzas Tradicionales", "description": "Base de tomate, queso y peperoni"},
            
            {"name": "Italiana Grande", "price": 189.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, salami y champiñones"},
            {"name": "Italiana Familiar", "price": 219.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, salami y champiñones"},
            
            {"name": "Ohana Hawaiana Grande", "price": 189.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, piña y tocino"},
            {"name": "Ohana Hawaiana Familiar", "price": 219.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, jamón, piña y tocino"},
            
            {"name": "Mama Meat Grande", "price": 189.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, peperoni, jamón y tocino"},
            {"name": "Mama Meat Familiar", "price": 219.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, peperoni, jamón y tocino"},
            
            {"name": "Molson Pizza Grande", "price": 189.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, peperoni, jamón y tocino"},
            {"name": "Molson Pizza Familiar", "price": 219.00, "category": "Pizzas Tradicionales", "description": "Base de tomate y queso, peperoni, jamón y tocino"},

            # PIZZAS ESPECIALES
            {"name": "Cuatro Quesos Grande", "price": 249.00, "category": "Pizzas Especiales", "description": "Base de tomate, queso manchego, mozzarella, parmesano y roquefort"},
            {"name": "Cuatro Quesos Familiar", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate, queso manchego, mozzarella, parmesano y roquefort"},
            
            {"name": "Bacon Special Grande", "price": 249.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, tocino hecho en casa, pimientos, champiñones y dip de tocino"},
            {"name": "Bacon Special Familiar", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, tocino hecho en casa, pimientos, champiñones y dip de tocino"},
            
            {"name": "Suprema 74 Grande", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, jamón, salami, champiñones, cebolla y pimientos"},
            {"name": "Suprema 74 Familiar", "price": 319.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, jamón, salami, champiñones, cebolla y pimientos"},
            
            {"name": "Peperoni Extreme Grande", "price": 219.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, doble peperoni y orilla de philadelphia con chipotle"},
            {"name": "Peperoni Extreme Familiar", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, doble peperoni y orilla de philadelphia con chipotle"},
            
            {"name": "Canadian BBQ Grande", "price": 289.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, pierna ahumada de cerdo en salsa bbq chipotle, piña y ranch"},
            {"name": "Canadian BBQ Familiar", "price": 319.00, "category": "Pizzas Especiales", "description": "Base de tomate y queso, pierna ahumada de cerdo en salsa bbq chipotle, piña y ranch"},
        ]

        for item in menu_data:
            new_item = models.MenuItem(
                **item,
                organization_id=org_id
            )
            db.add(new_item)
        
        db.commit()
        print(f"✅ Menú de Horno 74 cargado con éxito ({len(menu_data)} items).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error cargando el menú: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_menu()
