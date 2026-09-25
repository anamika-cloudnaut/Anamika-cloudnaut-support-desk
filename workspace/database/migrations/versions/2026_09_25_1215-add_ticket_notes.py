"""add ticket notes

Revision ID: 4a6f4c2d7b11
Revises: d1fead5c1331
Create Date: 2026-09-25 12:15:00+00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "4a6f4c2d7b11"
down_revision = "d1fead5c1331"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ticket_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("support_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_ticket_notes_id", "ticket_notes", ["id"])
    op.create_index("ix_ticket_notes_request_id", "ticket_notes", ["request_id"])


def downgrade():
    op.drop_index("ix_ticket_notes_request_id", table_name="ticket_notes")
    op.drop_index("ix_ticket_notes_id", table_name="ticket_notes")
    op.drop_table("ticket_notes")
