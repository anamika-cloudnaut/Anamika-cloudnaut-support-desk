"""add ticket notes

Revision ID: add_ticket_notes
Revises: d1fead5c1331
Create Date: 2026-09-25 12:00:00+00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "add_ticket_notes"
down_revision = "d1fead5c1331"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ticket_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["support_requests.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_notes_id", "ticket_notes", ["id"], unique=False)


def downgrade():
    op.drop_index("ix_ticket_notes_id", table_name="ticket_notes")
    op.drop_table("ticket_notes")