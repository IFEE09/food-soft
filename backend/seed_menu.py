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

        # 6. Menú Completo (27 Items)
        menu_items = [
            # ENTRADAS
            ("Peperoni Bites", 79, "Entradas"),
            ("Pan con Ajo y Queso", 125, "Entradas"),
            ("Cheese Bread", 125, "Entradas"),
            ("Calzone", 149, "Entradas"),
            ("Dip de Espinaca y Tocino", 149, "Entradas"),
            # TRADICIONALES
            ("Doble Queso Grande", 149, "Pizzas Tradicionales"),
            ("Doble Queso Familiar", 169, "Pizzas Tradicionales"),
            ("Peperoni Grande", 149, "Pizzas Tradicionales"),
            ("Peperoni Familiar", 169, "Pizzas Tradicionales"),
            ("Italiana Grande", 189, "Pizzas Tradicionales"),
            ("Italiana Familiar", 219, "Pizzas Tradicionales"),
            ("Ohana Hawaiana Grande", 189, "Pizzas Tradicionales"),
            ("Ohana Hawaiana Familiar", 219, "Pizzas Tradicionales"),
            ("Mama Meat Grande", 189, "Pizzas Tradicionales"),
            ("Mama Meat Familiar", 219, "Pizzas Tradicionales"),
            ("Molson Pizza Grande", 189, "Pizzas Tradicionales"),
            ("Molson Pizza Familiar", 219, "Pizzas Tradicionales"),
            # ESPECIALES
            ("Cuatro Quesos Grande", 249, "Pizzas Especiales"),
            ("Cuatro Quesos Familiar", 289, "Pizzas Especiales"),
            ("Bacon Special Grande", 249, "Pizzas Especiales"),
            ("Bacon Special Familiar", 289, "Pizzas Especiales"),
            ("Suprema 74 Grande", 289, "Pizzas Especiales"),
            ("Suprema 74 Familiar", 319, "Pizzas Especiales"),
            ("Peperoni Extreme Grande", 219, "Pizzas Especiales"),
            ("Peperoni Extreme Familiar", 289, "Pizzas Especiales"),
            ("Canadian BBQ Grande", 289, "Pizzas Especiales"),
            ("Canadian BBQ Familiar", 319, "Pizzas Especiales"),
        ]

        for name, price, cat in menu_items:
            new_item = models.MenuItem(
                name=name,
                price=price,
                category=cat,
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


