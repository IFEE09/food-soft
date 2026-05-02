"""Asegura variables de entorno antes de importar la app (tests / sqlite)."""
import os

os.environ.setdefault("ENV", "development")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
