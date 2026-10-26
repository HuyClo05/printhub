"""add immutable profiles and durable self-hosted slicing queue

Revision ID: 005_self_hosted_slice_pipeline
Revises: 004_add_slicing_job_state
Create Date: 2026-10-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "005_self_hosted_slice_pipeline"
down_revision: Union[str, Sequence[str], None] = "004_add_slicing_job_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "slicer_profile_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("object_key", sa.String(length=2048), nullable=False),
        sa.Column("source_bundle_sha256", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "category IN ('printers', 'presets', 'filaments')",
            name="ck_slicer_profile_versions_category",
        ),
        sa.UniqueConstraint(
            "owner_id", "category", "name", "version",
            name="uq_slicer_profile_versions_owner_name_version",
        ),
    )
    op.create_index("ix_slicer_profile_versions_owner_id", "slicer_profile_versions", ["owner_id"])
    op.create_index(
        "ix_slicer_profile_versions_lookup",
        "slicer_profile_versions",
        ["owner_id", "category", "name", "version"],
    )

    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("endpoint", sa.String(length=128), nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id", "endpoint", "key", name="uq_idempotency_owner_endpoint_key"),
    )

    op.add_column("stl_files", sa.Column("content_type", sa.String(length=255), nullable=True))
    op.add_column("stl_files", sa.Column("sha256", sa.String(length=64), nullable=True))
    op.add_column("stl_files", sa.Column("upload_status", sa.String(length=16), nullable=False, server_default="ready"))
    op.add_column("stl_files", sa.Column("upload_expires_at", sa.DateTime(timezone=True), nullable=True))

    for column in ("printer", "process", "filament"):
        op.add_column(
            "print_tasks",
            sa.Column(f"{column}_profile_version_id", sa.String(length=36), nullable=True),
        )
        op.create_foreign_key(
            f"fk_print_tasks_{column}_profile_version_id",
            "print_tasks",
            "slicer_profile_versions",
            [f"{column}_profile_version_id"],
            ["id"],
            ondelete="RESTRICT",
        )
    op.add_column("print_tasks", sa.Column("gcode_sha256", sa.String(length=64), nullable=True))
    op.add_column("print_tasks", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("print_tasks", sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"))
    op.add_column("print_tasks", sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))
    op.add_column("print_tasks", sa.Column("lease_owner", sa.String(length=255), nullable=True))
    op.add_column("print_tasks", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("print_tasks", sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("print_tasks", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("print_tasks", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("print_tasks", sa.Column("dead_lettered_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_print_tasks_queue_claim", "print_tasks", ["status", "available_at", "lease_expires_at"])

    op.drop_constraint("ck_print_jobs_status", "print_jobs", type_="check")
    op.create_check_constraint(
        "ck_print_jobs_status",
        "print_jobs",
        "status IN ('pending', 'queued', 'slicing', 'retrying', 'in-progress', 'completed', 'failed', 'dead-lettered', 'cancelled')",
    )
    op.drop_constraint("ck_print_tasks_status", "print_tasks", type_="check")
    op.create_check_constraint(
        "ck_print_tasks_status",
        "print_tasks",
        "status IN ('pending', 'slicing', 'queued', 'retrying', 'printing', 'in-progress', 'completed', 'failed', 'dead-lettered', 'cancelled')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_print_tasks_status", "print_tasks", type_="check")
    op.create_check_constraint(
        "ck_print_tasks_status",
        "print_tasks",
        "status IN ('pending', 'slicing', 'queued', 'printing', 'in-progress', 'completed', 'failed', 'cancelled')",
    )
    op.drop_constraint("ck_print_jobs_status", "print_jobs", type_="check")
    op.create_check_constraint(
        "ck_print_jobs_status",
        "print_jobs",
        "status IN ('pending', 'queued', 'slicing', 'in-progress', 'completed', 'failed', 'cancelled')",
    )
    op.drop_index("ix_print_tasks_queue_claim", table_name="print_tasks")
    for column in (
        "dead_lettered_at", "completed_at", "started_at", "last_heartbeat_at",
        "lease_expires_at", "lease_owner", "available_at", "max_attempts",
        "attempt_count", "gcode_sha256",
    ):
        op.drop_column("print_tasks", column)
    for profile_type in ("filament", "process", "printer"):
        op.drop_constraint(f"fk_print_tasks_{profile_type}_profile_version_id", "print_tasks", type_="foreignkey")
        op.drop_column("print_tasks", f"{profile_type}_profile_version_id")
    for column in ("upload_expires_at", "upload_status", "sha256", "content_type"):
        op.drop_column("stl_files", column)
    op.drop_index("ix_slicer_profile_versions_lookup", table_name="slicer_profile_versions")
    op.drop_index("ix_slicer_profile_versions_owner_id", table_name="slicer_profile_versions")
    op.drop_table("idempotency_records")
    op.drop_table("slicer_profile_versions")
