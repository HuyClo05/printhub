"""Printer pairing and durable command delivery.

Revision ID: 006_workspace_printers
Revises: 005_self_hosted_slice_pipeline
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "006_workspace_printers"
down_revision = "005_self_hosted_slice_pipeline"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("print_tasks", sa.Column("slice_options", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.create_table("printer_connections",
        sa.Column("printer_id", sa.String(36), sa.ForeignKey("printers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("host_type", sa.String(24), nullable=False),
        sa.Column("profile_name", sa.String(255)),
        sa.Column("pairing_hash", sa.String(64), unique=True),
        sa.Column("pairing_expires_at", sa.DateTime(timezone=True)),
        sa.Column("token_hash", sa.String(64), unique=True),
        sa.Column("telemetry", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.create_table("printer_commands",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("printer_id", sa.String(36), sa.ForeignKey("printers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("error_message", sa.String(2000)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)))
    op.create_index("ix_printer_commands_printer_id", "printer_commands", ["printer_id"])


def downgrade():
    op.drop_table("printer_commands")
    op.drop_table("printer_connections")
    op.drop_column("print_tasks", "slice_options")
