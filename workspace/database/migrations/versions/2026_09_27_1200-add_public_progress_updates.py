"""Distinguish requester-visible progress updates from internal notes.

Revision ID: 5b817c4a2e90
Revises: a9c4f5128e31
Create Date: 2026-09-27 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "5b817c4a2e90"
down_revision = "a9c4f5128e31"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "ticket_notes",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column("ticket_notes", "is_public")