import os, sys
sys.path.insert(0, '.')

# Cargar .env manualmente
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

from app.db.session import SessionLocal
from app.db import models

db = SessionLocal()
items = db.query(models.MenuItem).order_by(models.MenuItem.id).all()
print(f"Total productos: {len(items)}\n")
for i in items:
    print(f"ID:{i.id:3} | {i.name:<40} | ${i.price:>7.2f} | disponible:{i.is_available}")
db.close()
