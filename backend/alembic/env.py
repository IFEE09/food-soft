"""
Alembic env — wired al stack del proyecto.

URL de DB y metadata se toman del propio app (no de alembic.ini), así una sola fuente
de verdad. Para correr migrations:

    alembic upgrade head        # aplica todas
    alembic revision --autogenerate -m "msg"   # genera nueva
    alembic downgrade -1        # rollback una

En CI/Railway: ejecutar `alembic upgrade head` antes de levantar el web service.
"""

from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Importar la app para reusar settings + Base.metadata.
from app.core.config import settings
from app.db.session import Base
# Importar TODOS los modelos para que estén registrados en Base.metadata
# antes de que autogenerate inspeccione el schema.
from app.db import models  # noqa: F401

config = context.config

# Inyecta la URL de DB desde settings (env var DATABASE_URL gana sobre alembic.ini).
config.set_main_option("sqlalchemy.url", settings.get_database_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """SQL script mode: emite SQL sin conectarse."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Conecta y aplica migrations."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
