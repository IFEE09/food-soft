import logging
import secrets
from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.db.session import engine, get_db
from app.db import models
from app.api import auth, kitchens, users, supplies, orders, menu, integrations, activity_logs, bot, organizations
from app.core.notifier import manager
from app.core import security

# For simple MVP/Dev, we check for missing columns on startup
def run_migrations():
    logger.info("Sincronizando esquema de base de datos...")
    # Create Organizations table FIRST
    models.Base.metadata.create_all(bind=engine)

    migrations = [
        "ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE supplies ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE kitchens ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE orders ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE menu_items ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE supplies ADD COLUMN cost FLOAT DEFAULT 0.0",
        "ALTER TABLE organizations ADD COLUMN api_key VARCHAR UNIQUE",
    ]

    for query in migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(query))
                conn.commit()
                column_name = query.split('ADD COLUMN ')[1].split(' ')[0]
                logger.info("Migración: Columna '%s' añadida con éxito.", column_name)
        except Exception:
            # El error es silencioso porque la columna probablemente ya existe (psycopg2.errors.DuplicateColumn)
            pass

# Create/Fix users and organizations
def init_db_data():
    db = next(get_db())
    
    # 1. FIX: Assign default organization to users that don't have one (legacy users)
    legacy_users = db.query(models.User).filter(models.User.organization_id.is_(None)).all()
    for lu in legacy_users:
        new_org = models.Organization(name=f"Kitchen of {lu.full_name}", api_key=secrets.token_urlsafe(32))
        db.add(new_org)
        db.flush()
        lu.organization_id = new_org.id
        logger.info("Reparación: Organización asignada al usuario %s", lu.email)
    db.commit()

    # 2. SEED: Create initial Admin/Owner if table is completely empty
    owner = db.query(models.User).filter(models.User.role == "owner").first()
    # ... (rest of old code if relevant, but the loop above already handles it)

# Start Sync & Seed
run_migrations()
init_db_data()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Smart POS System",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(supplies.router, prefix=f"{settings.API_V1_STR}/supplies", tags=["supplies"])
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}/orders", tags=["orders"])
app.include_router(menu.router, prefix=f"{settings.API_V1_STR}/menu", tags=["menu"])
app.include_router(integrations.router, prefix=f"{settings.API_V1_STR}/integrations", tags=["integrations"])
app.include_router(kitchens.router, prefix=f"{settings.API_V1_STR}/kitchens", tags=["kitchens"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(activity_logs.router, prefix=f"{settings.API_V1_STR}/activity-logs", tags=["activity-logs"])
app.include_router(bot.router, prefix=f"{settings.API_V1_STR}/bot", tags=["bot"])
app.include_router(organizations.router, prefix=f"{settings.API_V1_STR}/organizations", tags=["organizations"])

@app.get("/")
def root():
    return {"message": "Food-Soft Dark Kitchen System API is Online"}

@app.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: int):
    await manager.connect(websocket, org_id)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket, org_id)

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        logger.exception("Health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable")
