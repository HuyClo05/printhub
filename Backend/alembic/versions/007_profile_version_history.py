"""Preset version notes and restore lineage.

Revision ID: 007_profile_version_history
Revises: 006_workspace_printers
"""
from alembic import op
import sqlalchemy as sa

revision = "007_profile_version_history"
down_revision = "006_workspace_printers"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("slicer_profile_versions", sa.Column("note", sa.Text(), nullable=True))
    op.add_column("slicer_profile_versions", sa.Column(
        "restored_from_id", sa.String(36),
        sa.ForeignKey("slicer_profile_versions.id", ondelete="SET NULL"), nullable=True))


def downgrade():
    op.drop_column("slicer_profile_versions", "restored_from_id")
    op.drop_column("slicer_profile_versions", "note")
