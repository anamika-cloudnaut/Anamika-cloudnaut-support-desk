"""Add request attachment metadata.

Revision ID: f31b2b6d9c42
Revises: c19f8e72a341
Create Date: 2026-09-29 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "f31b2b6d9c42"
down_revision = "c19f8e72a341"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "request_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Integer(),
            sa.ForeignKey("support_requests.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by_id",
            sa.Integer(),
            sa.ForeignKey("team_members.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_request_attachments_id", "request_attachments", ["id"])
    op.create_index(
        "ix_request_attachments_request_id",
        "request_attachments",
        ["request_id"],
    )
    op.create_index(
        "ix_request_attachments_uploaded_by_id",
        "request_attachments",
        ["uploaded_by_id"],
    )


def downgrade():
    op.drop_index(
        "ix_request_attachments_uploaded_by_id",
        table_name="request_attachments",
    )
    op.drop_index(
        "ix_request_attachments_request_id",
        table_name="request_attachments",
    )
    op.drop_index("ix_request_attachments_id", table_name="request_attachments")
    op.drop_table("request_attachments")
