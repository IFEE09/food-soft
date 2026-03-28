from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine, get_db
from app.db import models

# For simple MVP, create tables automatically on startup.
# In production, use Alembic via `alembic upgrade head`.
models.Base.metadata.create_all(bind=engine)

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
