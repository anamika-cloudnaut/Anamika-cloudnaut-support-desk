"""Add pending access requests for admin review.

Revision ID: a9c4f5128e31
Revises: 7c2b9e1a4d60
Create Date: 2026-09-27 11:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "a9c4f5128e31"
down_revision = "7c2b9e1a4d60"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "access_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.CheckConstraint("role IN ('employee', 'support')", name="ck_access_requests_role"),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_access_requests_status"),
    )
    op.create_index("ix_access_requests_id", "access_requests", ["id"])
    op.create_index("ix_access_requests_email", "access_requests", ["email"])
    op.create_index("ix_access_requests_status", "access_requests", ["status"])


def downgrade():
    op.drop_index("ix_access_requests_status", table_name="access_requests")
    op.drop_index("ix_access_requests_email", table_name="access_requests")
    op.drop_index("ix_access_requests_id", table_name="access_requests")
    op.drop_table("access_requests")