from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine, get_db
from app.db import models
from app.api import auth, supplies
from app.core import security

# For simple MVP, create tables automatically on startup.
# In production, use Alembic via `alembic upgrade head`.
models.Base.metadata.create_all(bind=engine)

# Create initial user if not exists
def init_db():
    db = next(get_db())
    # Check if we have any users
    owner = db.query(models.User).filter(models.User.role == "owner").first()
    if not owner:
        print("Creating initial Admin/Owner user...")
        initial_user = models.User(
            email="owner@foodsoft.com",
            full_name="Dueño Food-Soft",
            hashed_password=security.get_password_hash("admin123"), # Default password
            role="owner",
            is_active=True
        )
        db.add(initial_user)
        # Add also a cook for testing
        cook_user = models.User(
            email="cook@foodsoft.com",
            full_name="Cocinero Food-Soft",
            hashed_password=security.get_password_hash("cook123"),
            role="cook",
            is_active=True
        )
        db.add(cook_user)
        db.commit()
    db.close()

init_db()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Smart POS System",
    version="1.0.0",
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For now allowing all, change in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(supplies.router, prefix=f"{settings.API_V1_STR}/supplies", tags=["supplies"])


@app.get("/")
def read_root():
    return {"message": "Welcome to Food-Soft API"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """ Check connection to database """
    try:
        # Check if database is accessible
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database connection failed")
