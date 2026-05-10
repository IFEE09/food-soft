"""add supply_movements table

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-10

"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supply_movements",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("supply_id", sa.Integer(), sa.ForeignKey("supplies.id"), nullable=False, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=True, index=True),
        sa.Column("movement_type", sa.String(), nullable=False, server_default="in"),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("supply_movements")
