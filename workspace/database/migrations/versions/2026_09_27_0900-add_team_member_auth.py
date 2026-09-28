"""Add team-member roles and credentials.

Revision ID: 7c2b9e1a4d60
Revises: 4a6f4c2d7b11
Create Date: 2026-09-27 09:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "7c2b9e1a4d60"
down_revision = "4a6f4c2d7b11"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "team_members",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="support"),
    )
    op.add_column(
        "team_members",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )


def downgrade():
    op.drop_column("team_members", "password_hash")
    op.drop_column("team_members", "role")