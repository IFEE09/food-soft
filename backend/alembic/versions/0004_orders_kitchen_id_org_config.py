"""add orders.kitchen_id + organization config columns (delivery_phone, menu_image_url)

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-10
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # ── orders.kitchen_id ────────────────────────────────────────────────────
    # Endpoints REST de pedidos (POST/PUT /orders) referenciaban kitchen_id sin
    # que la columna existiera → AttributeError en runtime. Esta migración la
    # agrega para alinear esquema y modelo.
    if "orders" in tables:
        columns = [c["name"] for c in inspector.get_columns("orders")]
        if "kitchen_id" not in columns:
            op.add_column(
                "orders",
                sa.Column("kitchen_id", sa.Integer, sa.ForeignKey("kitchens.id"), nullable=True),
            )
            op.create_index("ix_orders_kitchen_id", "orders", ["kitchen_id"])

    # ── organizations: delivery_phone + menu_image_url ──────────────────────
    # Eliminan hardcodes que rompían multi-tenancy:
    #  - delivery_phone: teléfono del repartidor de cada restaurante.
    #  - menu_image_url: URL de la imagen del menú que envía el bot.
    if "organizations" in tables:
        columns = [c["name"] for c in inspector.get_columns("organizations")]
        if "delivery_phone" not in columns:
            op.add_column("organizations", sa.Column("delivery_phone", sa.String, nullable=True))
        if "menu_image_url" not in columns:
            op.add_column("organizations", sa.Column("menu_image_url", sa.String, nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "menu_image_url")
    op.drop_column("organizations", "delivery_phone")
    op.drop_index("ix_orders_kitchen_id", "orders")
    op.drop_column("orders", "kitchen_id")
