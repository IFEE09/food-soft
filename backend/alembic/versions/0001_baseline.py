"""baseline schema

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-08

Baseline: crea TODO el schema desde Base.metadata. Estrategia idempotente:
si las tablas ya existen (DB pre-Alembic), `op.execute("SELECT 1")` no rompe;
en su lugar usar `alembic stamp 0001_baseline` para marcar como aplicada sin re-crear.

Para nuevos despliegues:
    alembic upgrade head

Para DBs existentes (que ya tienen las tablas creadas por el viejo run_migrations):
    alembic stamp 0001_baseline
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# Revisión
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Crea todas las tablas desde Base.metadata.

    Usamos `create_all` con `checkfirst=True` para ser idempotentes en DBs
    parcialmente migradas. Para DBs limpias funciona como un schema fresh.
    """
    from app.db.session import Base
    # Importar todos los modelos para asegurar registro en metadata.
    from app.db import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    """Drop completo. Solo usar en dev."""
    from app.db.session import Base
    from app.db import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
