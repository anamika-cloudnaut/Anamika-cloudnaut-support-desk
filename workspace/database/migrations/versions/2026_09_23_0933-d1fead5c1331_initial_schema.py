"""initial_schema

Revision ID: d1fead5c1331
Revises: None
Create Date: 2026-09-23 09:33:09.516248+00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "d1fead5c1331"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_team_members_id", "team_members", ["id"])

    op.create_table(
        "support_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("requester_name", sa.String(length=100), nullable=False),
        sa.Column("requester_email", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="Open"),
        sa.Column(
            "assigned_to",
            sa.Integer(),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_support_requests_id", "support_requests", ["id"])

    op.create_table(
        "history_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("support_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_history_events_id", "history_events", ["id"])


def downgrade():
    op.drop_index("ix_history_events_id", table_name="history_events")
    op.drop_table("history_events")
    op.drop_index("ix_support_requests_id", table_name="support_requests")
    op.drop_table("support_requests")
    op.drop_index("ix_team_members_id", table_name="team_members")
    op.drop_table("team_members")
