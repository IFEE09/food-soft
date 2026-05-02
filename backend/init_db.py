from app.db.session import engine, Base
from app.db import models # Asegurar que los modelos se registren en Base.metadata

def init_db():
    print("Creando tablas en la base de datos...")
    Base.metadata.create_all(bind=engine)
    print("Tablas creadas exitosamente.")

if __name__ == "__main__":
    init_db()
