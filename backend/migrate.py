from sqlalchemy import text
from app.db.session import engine

def migrate():
    with engine.connect() as conn:
        print("Iniciando migración manual...")
        
        # 1. Crear tabla organizations si no existe
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                api_key VARCHAR UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 2. Añadir organization_id a las tablas existentes
        tables = ["users", "supplies", "kitchens", "orders", "menu_items"]
        
        for table in tables:
            try:
                print(f"Añadiendo organization_id a {table}...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN organization_id INTEGER REFERENCES organizations(id)"))
            except Exception as e:
                print(f"Aviso: La columna en {table} probablemente ya existe. Saltando... ({e})")
        
        # 3. Añadir api_key a organizations si no existe (por si acaso)
        try:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN api_key VARCHAR UNIQUE"))
        except:
            pass

        conn.commit()
        print("¡Migración completada con éxito!")

if __name__ == "__main__":
    migrate()
