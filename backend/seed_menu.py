import secrets
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import models
from app.core import security
from app.core.api_keys import hash_api_key

def seed_menu():
    db = SessionLocal()
    try:
        # 1. Asegurar Organización
        org = db.query(models.Organization).filter(models.Organization.name == "Horno 74").first()
        if not org:
            raw_key = secrets.token_urlsafe(32)
            org = models.Organization(
                name="Horno 74",
                api_key_hash=hash_api_key(raw_key)
            )
            db.add(org)
            db.commit()
            db.refresh(org)
        
        org_id = org.id

        # 2. Asegurar Usuario Admin (Owner)
        admin_email = "admin@horno74.com"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            admin = models.User(
                email=admin_email,
                full_name="Admin Horno 74",
                hashed_password=security.get_password_hash("Horno74Secure123"),
                role="owner",
                is_active=True,
                organization_id=org_id
            )
            db.add(admin)
            db.commit()
            print(f"✅ Usuario Admin creado: {admin_email}")

        # 3. Asegurar Estación (Kitchen)
        kitchen = db.query(models.Kitchen).filter(
            models.Kitchen.name == "Horno",
            models.Kitchen.organization_id == org_id
        ).first()
        if not kitchen:
            kitchen = models.Kitchen(name="Horno", organization_id=org_id)
            db.add(kitchen)
            db.commit()

        # 4. Insumos Básicos
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

        # 5. Limpiar menú anterior (primero recetas por la llave foránea)
        db.query(models.MenuItemRecipe).filter(
            models.MenuItemRecipe.menu_item_id.in_(
                db.query(models.MenuItem.id).filter(models.MenuItem.organization_id == org_id)
            )
        ).delete(synchronize_session=False)
        db.query(models.MenuItem).filter(models.MenuItem.organization_id == org_id).delete()
        db.commit()

        # 6. Menú Completo (27 Items) — (nombre, precio, categoría, descripción)
        menu_items = [
            # ENTRADAS — sin variantes de tamaño
            ("Peperoni Bites",          79,  "Entradas",              None),
            ("Pan con Ajo y Queso",     125, "Entradas",              None),
            ("Cheese Bread",            125, "Entradas",              None),
            ("Calzone",                 149, "Entradas",              None),
            ("Dip de Espinaca y Tocino",149, "Entradas",              None),
            # PIZZAS TRADICIONALES
            ("Doble Queso Grande",      149, "Pizzas Tradicionales",  "Base de tomate y doble queso"),
            ("Doble Queso Familiar",    169, "Pizzas Tradicionales",  "Base de tomate y doble queso"),
            ("Peperoni Grande",         149, "Pizzas Tradicionales",  "Base de tomate, queso y peperoni"),
            ("Peperoni Familiar",       169, "Pizzas Tradicionales",  "Base de tomate, queso y peperoni"),
            ("Italiana Grande",         189, "Pizzas Tradicionales",  "Base de tomate y queso, jamón, salami y champiñones"),
            ("Italiana Familiar",       219, "Pizzas Tradicionales",  "Base de tomate y queso, jamón, salami y champiñones"),
            ("Ohana Hawaiana Grande",   189, "Pizzas Tradicionales",  "Base de tomate y queso, jamón, piña y tocino"),
            ("Ohana Hawaiana Familiar", 219, "Pizzas Tradicionales",  "Base de tomate y queso, jamón, piña y tocino"),
            ("Mama Meat Grande",        189, "Pizzas Tradicionales",  "Base de tomate y queso, peperoni, jamón y tocino"),
            ("Mama Meat Familiar",      219, "Pizzas Tradicionales",  "Base de tomate y queso, peperoni, jamón y tocino"),
            ("Molson Pizza Grande",     189, "Pizzas Tradicionales",  "Base de tomate y queso, peperoni, jamón y tocino"),
            ("Molson Pizza Familiar",   219, "Pizzas Tradicionales",  "Base de tomate y queso, peperoni, jamón y tocino"),
            # PIZZAS ESPECIALES
            ("Cuatro Quesos Grande",    249, "Pizzas Especiales",     "Base de tomate, queso manchego, mozzarella, parmesano y roquefort"),
            ("Cuatro Quesos Familiar",  289, "Pizzas Especiales",     "Base de tomate, queso manchego, mozzarella, parmesano y roquefort"),
            ("Bacon Special Grande",    249, "Pizzas Especiales",     "Base de tomate y queso, tocino hecho en casa, pimientos, champiñones y dip de tocino"),
            ("Bacon Special Familiar",  289, "Pizzas Especiales",     "Base de tomate y queso, tocino hecho en casa, pimientos, champiñones y dip de tocino"),
            ("Suprema 74 Grande",       289, "Pizzas Especiales",     "Base de tomate y queso, jamón, salami, champiñones, cebolla y pimientos"),
            ("Suprema 74 Familiar",     319, "Pizzas Especiales",     "Base de tomate y queso, jamón, salami, champiñones, cebolla y pimientos"),
            ("Peperoni Extreme Grande", 219, "Pizzas Especiales",     "Base de tomate y queso, doble peperoni y orilla de philadelphia con chipotle"),
            ("Peperoni Extreme Familiar",289,"Pizzas Especiales",     "Base de tomate y queso, doble peperoni y orilla de philadelphia con chipotle"),
            ("Canadian BBQ Grande",     289, "Pizzas Especiales",     "Base de tomate y queso, pierna ahumada de cerdo en salsa BBQ chipotle, piña y ranch"),
            ("Canadian BBQ Familiar",   319, "Pizzas Especiales",     "Base de tomate y queso, pierna ahumada de cerdo en salsa BBQ chipotle, piña y ranch"),
        ]

        for name, price, cat, desc in menu_items:
            new_item = models.MenuItem(
                name=name,
                price=price,
                category=cat,
                description=desc,
                organization_id=org_id
            )
            db.add(new_item)
            db.flush()
            
            # Receta genérica para todas (Masa + Queso + Salsa)
            db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Masa de Pizza (bollo)"], quantity=1))
            db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Queso Mozzarella"], quantity=0.25))
            db.add(models.MenuItemRecipe(menu_item_id=new_item.id, supply_id=supply_map["Salsa de Tomate"], quantity=0.15))
        
        db.commit()
        print(f"✅ Menú de Horno 74 cargado con éxito ({len(menu_items)} items).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error cargando el menú: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_menu()


