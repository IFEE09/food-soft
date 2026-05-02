from sqlalchemy import create_engine, text
from app.core.config import settings

def create_db_if_not_exists():
    # Conectar a la base de datos 'postgres' por defecto
    default_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/postgres"
    engine = create_engine(default_url, isolation_level="AUTOCOMMIT")
    
    try:
        with engine.connect() as conn:
            # Verificar si la base de datos ya existe
            result = conn.execute(text(f"SELECT 1 FROM pg_database WHERE datname='{settings.POSTGRES_DB}'"))
            exists = result.scalar()
            
            if not exists:
                print(f"Creando base de datos '{settings.POSTGRES_DB}'...")
                conn.execute(text(f"CREATE DATABASE {settings.POSTGRES_DB}"))
                print("Base de datos creada.")
            else:
                print(f"La base de datos '{settings.POSTGRES_DB}' ya existe.")
    except Exception as e:
        print(f"Error al intentar crear la base de datos: {e}")
    finally:
        engine.dispose()

if __name__ == "__main__":
    create_db_if_not_exists()
