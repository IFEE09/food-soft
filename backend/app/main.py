import asyncio
import json
import logging
import secrets
from contextlib import asynccontextmanager

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.db.session import SessionLocal, engine, get_db
from app.db import models
from app.api import auth, kitchens, users, supplies, orders, menu, integrations, activity_logs, bot, organizations, stations
from app.core.notifier import manager, set_main_loop
from app.core import security
from app.core.rate_limit import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.api_keys import hash_api_key

# For simple MVP/Dev, we check for missing columns on startup
def run_migrations():
    logger.info("Sincronizando esquema de base de datos...")
    # Create Organizations table FIRST
    models.Base.metadata.create_all(bind=engine)

    migrations = [
        "CREATE TABLE IF NOT EXISTS user_organization_link (user_id INTEGER REFERENCES users(id), organization_id INTEGER REFERENCES organizations(id), PRIMARY KEY (user_id, organization_id))",
        "CREATE TABLE IF NOT EXISTS stations (id SERIAL PRIMARY KEY, name VARCHAR NOT NULL, is_active BOOLEAN DEFAULT TRUE, kitchen_id INTEGER REFERENCES kitchens(id), organization_id INTEGER REFERENCES organizations(id))",
        "ALTER TABLE kitchens ADD COLUMN address VARCHAR",
        "ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE supplies ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE kitchens ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE orders ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE orders ADD COLUMN station_id INTEGER REFERENCES stations(id)",
        "ALTER TABLE menu_items ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE supplies ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
        "ALTER TABLE supplies ADD COLUMN kitchen_id INTEGER REFERENCES kitchens(id)",
        "ALTER TABLE supplies ADD COLUMN cost FLOAT DEFAULT 0.0",
        "ALTER TABLE organizations ADD COLUMN api_key VARCHAR UNIQUE",
        "ALTER TABLE organizations ADD COLUMN api_key_hash VARCHAR UNIQUE",
        "ALTER TABLE users ADD COLUMN kitchen_id INTEGER REFERENCES kitchens(id)",
        "ALTER TABLE organizations ADD COLUMN whatsapp_phone_number_id VARCHAR UNIQUE",
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
    from app.core import security
    from app.core.api_keys import hash_api_key
    db = next(get_db())
    
    # 1. Asegurar Organización Horno 74
    org_name = "Horno 74"
    org = db.query(models.Organization).filter(models.Organization.name == org_name).first()
    if not org:
        raw_key = secrets.token_urlsafe(32)
        org = models.Organization(
            name=org_name,
            api_key_hash=hash_api_key(raw_key),
        )
        db.add(org)
        db.flush()
        logger.info("Auto-Seed: Organización '%s' creada.", org_name)
    
    org_id = org.id

    # 2. Asegurar Usuario Administrador
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
        db.flush()
        logger.info("Auto-Seed: Usuario '%s' creado.", admin_email)
    
    # 2b. Vincular admin a la organización (Many-to-Many)
    if org not in admin.organizations:
        admin.organizations.append(org)
    
    db.commit()

    # 3. Asegurar Menú Inicial (27 items)
    menu_count = db.query(models.MenuItem).filter(models.MenuItem.organization_id == org_id).count()
    if menu_count == 0:
        logger.info("Auto-Seed: Cargando menú inicial de 27 items para '%s'...", org_name)
        menu_items = [
            ("Peperoni Bites", 79, "Entradas"), ("Pan con Ajo y Queso", 125, "Entradas"),
            ("Cheese Bread", 125, "Entradas"), ("Calzone", 149, "Entradas"),
            ("Dip de Espinaca y Tocino", 149, "Entradas"), ("Doble Queso Grande", 149, "Pizzas Tradicionales"),
            ("Doble Queso Familiar", 169, "Pizzas Tradicionales"), ("Peperoni Grande", 149, "Pizzas Tradicionales"),
            ("Peperoni Familiar", 169, "Pizzas Tradicionales"), ("Italiana Grande", 189, "Pizzas Tradicionales"),
            ("Italiana Familiar", 219, "Pizzas Tradicionales"), ("Ohana Hawaiana Grande", 189, "Pizzas Tradicionales"),
            ("Ohana Hawaiana Familiar", 219, "Pizzas Tradicionales"), ("Mama Meat Grande", 189, "Pizzas Tradicionales"),
            ("Mama Meat Familiar", 219, "Pizzas Tradicionales"), ("Molson Pizza Grande", 189, "Pizzas Tradicionales"),
            ("Molson Pizza Familiar", 219, "Pizzas Tradicionales"), ("Cuatro Quesos Grande", 249, "Pizzas Especiales"),
            ("Cuatro Quesos Familiar", 289, "Pizzas Especiales"), ("Bacon Special Grande", 249, "Pizzas Especiales"),
            ("Bacon Special Familiar", 289, "Pizzas Especiales"), ("Suprema 74 Grande", 289, "Pizzas Especiales"),
            ("Suprema 74 Familiar", 319, "Pizzas Especiales"), ("Peperoni Extreme Grande", 219, "Pizzas Especiales"),
            ("Peperoni Extreme Familiar", 289, "Pizzas Especiales"), ("Canadian BBQ Grande", 289, "Pizzas Especiales"),
            ("Canadian BBQ Familiar", 319, "Pizzas Especiales"),
        ]
        for name, price, cat in menu_items:
            db.add(models.MenuItem(name=name, price=price, category=cat, organization_id=org_id))
        db.commit()
        logger.info("Auto-Seed: Menú cargado correctamente.")

    # 4. Reparación de usuarios antiguos si los hubiera
    legacy_users = db.query(models.User).filter(models.User.organization_id.is_(None)).all()
    for lu in legacy_users:
        lu.organization_id = org_id
    if legacy_users:
        db.commit()

# Start Sync & Seed
run_migrations()
init_db_data()


@asynccontextmanager
async def lifespan(app: FastAPI):
    set_main_loop(asyncio.get_running_loop())
    yield


_docs = settings.EXPOSE_OPENAPI and settings.ENV != "production"
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Smart POS System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

# Register Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(supplies.router, prefix=f"{settings.API_V1_STR}/supplies", tags=["supplies"])
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}/orders", tags=["orders"])
app.include_router(menu.router, prefix=f"{settings.API_V1_STR}/menu", tags=["menu"])
app.include_router(integrations.router, prefix=f"{settings.API_V1_STR}/integrations", tags=["integrations"])
app.include_router(kitchens.router, prefix=f"{settings.API_V1_STR}/kitchens", tags=["kitchens"])
app.include_router(stations.router, prefix=f"{settings.API_V1_STR}/stations", tags=["stations"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(activity_logs.router, prefix=f"{settings.API_V1_STR}/activity-logs", tags=["activity-logs"])
app.include_router(bot.router, prefix=f"{settings.API_V1_STR}/bot", tags=["bot"])
app.include_router(organizations.router, prefix=f"{settings.API_V1_STR}/organizations", tags=["organizations"])

@app.get("/")
def root():
    if settings.ENV == "production":
        return {"ok": True}
    return {"message": "Food-Soft Dark Kitchen System API is Online"}

@app.websocket("/ws/{org_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    org_id: int,
    token: Optional[str] = Query(
        None,
        description="Opcional (legacy). Preferir mensaje inicial JSON auth.",
    ),
):
    """
    Auth: (1) query ?token= (legacy, puede loguearse en proxies) o
    (2) primer mensaje texto: {"type":"auth","token":"<jwt>"}.
    """
    await websocket.accept()
    auth_token = token
    if not auth_token:
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=20.0)
            payload = json.loads(raw)
            if isinstance(payload, dict) and payload.get("type") == "auth":
                auth_token = payload.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError, TypeError, ValueError):
            await websocket.close(code=4401)
            return
    if not auth_token:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        try:
            uid = security.decode_access_token_subject(auth_token)
        except security.InvalidAccessToken:
            await websocket.close(code=4401)
            return
        user = db.query(models.User).filter(models.User.id == uid).first()
        if not user or not user.is_active:
            await websocket.close(code=4401)
            return
        if user.organization_id != org_id:
            await websocket.close(code=4403)
            return

        await manager.connect(websocket, org_id)
        try:
            while True:
                await websocket.receive_text()
        except Exception:
            manager.disconnect(websocket, org_id)
    finally:
        db.close()

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        logger.exception("Health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable")
