from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db.session import engine, get_db
from app.db import models
from app.api import auth, kitchens, users, supplies, orders, menu, integrations
from app.core.notifier import manager
from app.core import security

# For simple MVP/Dev, we check for missing columns on startup
def run_migrations():
    with engine.connect() as conn:
        print("Sincronizando esquema de base de datos...")
        # Create Organizations table FIRST
        models.Base.metadata.create_all(bind=engine)
        
        # Add organization_id to existing operational tables if they were created before multi-tenancy
        tables = ["users", "supplies", "kitchens", "orders", "menu_items"]
        for table in tables:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN organization_id INTEGER REFERENCES organizations(id)"))
                print(f"Migración: Columna organization_id añadida a {table}")
            except Exception:
                # Column probably exists
                pass
        
        # Add api_key to organizations if it was missing 
        try:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN api_key VARCHAR UNIQUE"))
            print("Migración: Columna api_key añadida a organizations")
        except Exception:
            pass
            
        conn.commit()

# Create initial user if not exists
def init_db_data():
    db = next(get_db())
    # Check if we have any users
    owner = db.query(models.User).filter(models.User.role == "owner").first()
    if not owner:
        print("Creando usuarios iniciales por defecto...")
        # Note: These default users won't have an Org initially unless we create one.
        # But for dev it helps have something.
        default_org = models.Organization(name="Default Organization", api_key=security.secrets.token_urlsafe(32))
        db.add(default_org)
        db.flush()

        initial_user = models.User(
            email="owner@foodsoft.com",
            full_name="Dueño Food-Soft",
            hashed_password=security.get_password_hash("admin123"),
            role="owner",
            is_active=True,
            organization_id=default_org.id
        )
        db.add(initial_user)
        db.commit()
    db.close()

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
