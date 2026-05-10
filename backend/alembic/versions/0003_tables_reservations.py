"""add restaurant_tables, reservations, order.channel, order.table_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-10
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # ── restaurant_tables ────────────────────────────────────────────────────
    if "restaurant_tables" not in tables:
        op.create_table(
            "restaurant_tables",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer, sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("kitchen_id", sa.Integer, sa.ForeignKey("kitchens.id"), nullable=True),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("name", sa.String, nullable=True),
        sa.Column("capacity", sa.Integer, default=4),
        sa.Column("status", sa.String, nullable=False, server_default="available", index=True),
        sa.Column("pos_x", sa.Float, server_default="0.0"),
        sa.Column("pos_y", sa.Float, server_default="0.0"),
        sa.Column("shape", sa.String, server_default="square"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "number", name="uq_table_number_per_org"),
    )

    # ── reservations ─────────────────────────────────────────────────────────
    if "reservations" not in tables:
        op.create_table(
            "reservations",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer, sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("table_id", sa.Integer, sa.ForeignKey("restaurant_tables.id"), nullable=True),
        sa.Column("guest_name", sa.String, nullable=False),
        sa.Column("guest_phone", sa.String, nullable=True),
        sa.Column("guest_email", sa.String, nullable=True),
        sa.Column("party_size", sa.Integer, server_default="2"),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer, server_default="90"),
        sa.Column("status", sa.String, nullable=False, server_default="pending", index=True),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("source", sa.String, server_default="online", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── orders: nuevas columnas channel y table_id ───────────────────────────
    if "orders" in tables:
        columns = [c["name"] for c in inspector.get_columns("orders")]
        if "channel" not in columns:
            op.add_column("orders", sa.Column("channel", sa.String, server_default="whatsapp", nullable=True, index=True))
        if "table_id" not in columns:
            op.add_column("orders", sa.Column("table_id", sa.Integer, sa.ForeignKey("restaurant_tables.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "table_id")
    op.drop_column("orders", "channel")
    op.drop_table("reservations")
    op.drop_table("restaurant_tables")
