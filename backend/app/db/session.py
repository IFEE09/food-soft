from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _build_engine(url: str):
    """Construye un engine. Pool config solo aplica a backends que lo soportan
    (SQLite usa SingletonThreadPool y rechaza pool_size/max_overflow)."""
    kwargs: dict = {"pool_pre_ping": True}
    if not url.startswith("sqlite"):
        kwargs.update(
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
        )
    return create_engine(url, **kwargs)


# Engine principal (RW). Único por proceso.
engine = _build_engine(settings.get_database_url())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Engine de réplica (RO) — opcional. Si no hay DATABASE_REPLICA_URL, apunta al primary.
# Endpoints que solo leen y son tolerantes a leve replication lag (dashboards, reports)
# pueden usar `get_db_ro` para bajar carga del primary.
_replica_url = settings.DATABASE_REPLICA_URL
if _replica_url:
    replica_engine = _build_engine(_replica_url)
    ReadOnlySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=replica_engine)
else:
    replica_engine = engine
    ReadOnlySessionLocal = SessionLocal


# Dependency for FastAPI (read-write).
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_ro():
    """Read-only session. Usar en endpoints SELECT-heavy que toleren replication lag.

    Si no hay réplica configurada, cae al primary. Cualquier write en una sesión RO
    funcionará (no la bloqueamos), pero por convención NO se hace.
    """
    db = ReadOnlySessionLocal()
    try:
        yield db
    finally:
        db.close()
