"""add printers, jobs, tasks, files, and queue tables

Revision ID: 002_print_workflow_schema
Revises: 001_create_initial_schema
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "002_print_workflow_schema"
down_revision: Union[str, Sequence[str], None] = "001_create_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("user_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_table(
        "stl_files",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("stl_url", sa.String(length=2048), nullable=True),
        sa.Column("gcode_url", sa.String(length=2048), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.Column("uploaded_by", sa.String(length=36), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stl_files_uploaded_by", "stl_files", ["uploaded_by"])

    op.create_table(
        "print_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("job_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimated_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_tasks", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'in-progress', 'completed', 'cancelled')",
            name="ck_print_jobs_status",
        ),
    )
    op.create_index("ix_print_jobs_created_by", "print_jobs", ["created_by"])

    op.create_table(
        "print_tasks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("file_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("estimated_print_time", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["file_id"], ["stl_files.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["job_id"], ["print_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'slicing', 'queued', 'printing', 'in-progress', 'completed', 'failed', 'cancelled')",
            name="ck_print_tasks_status",
        ),
    )
    op.create_index("ix_print_tasks_job_id", "print_tasks", ["job_id"])
    op.create_index("ix_print_tasks_file_id", "print_tasks", ["file_id"])

    op.create_table(
        "printers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("octoeverywhere_url", sa.String(length=2048), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("printer_presets", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("process_presets", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("filament_presets", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="offline"),
        sa.Column("nozzle_temp", sa.Float(), nullable=True),
        sa.Column("nozzle_temp_target", sa.Float(), nullable=True),
        sa.Column("bed_temp", sa.Float(), nullable=True),
        sa.Column("bed_temp_target", sa.Float(), nullable=True),
        sa.Column("fan_speed", sa.Integer(), nullable=True),
        sa.Column("webcam", sa.String(length=2048), nullable=True),
        sa.Column("current_task_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "state IN ('printing', 'ready', 'paused', 'error', 'offline')",
            name="ck_printers_state",
        ),
    )
    op.create_index("ix_printers_owner_id", "printers", ["owner_id"])
    op.create_index("ix_printers_current_task_id", "printers", ["current_task_id"])

    op.create_table(
        "printer_shares",
        sa.Column("printer_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["printer_id"], ["printers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("printer_id", "user_id"),
    )

    op.create_table(
        "print_task_printers",
        sa.Column("task_id", sa.String(length=36), nullable=False),
        sa.Column("printer_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["printer_id"], ["printers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["print_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("task_id", "printer_id"),
        sa.CheckConstraint(
            "status IN ('queued', 'printing', 'completed')",
            name="ck_print_task_printers_status",
        ),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="ck_print_task_printers_progress"),
    )

    op.create_table(
        "printer_queue",
        sa.Column("printer_id", sa.String(length=36), nullable=False),
        sa.Column("queue_position", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("added_by", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("estimated_time", sa.Integer(), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["job_id"], ["print_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["printer_id"], ["printers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["print_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("printer_id", "queue_position"),
        sa.UniqueConstraint("task_id"),
        sa.CheckConstraint(
            "status IN ('queued', 'slicing', 'ready')",
            name="ck_printer_queue_status",
        ),
    )
    op.create_index("ix_printer_queue_job_id", "printer_queue", ["job_id"])

    op.create_foreign_key(
        "fk_printers_current_task_id",
        "printers",
        "print_tasks",
        ["current_task_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_printers_current_task_id", "printers", type_="foreignkey")
    op.drop_index("ix_printer_queue_job_id", table_name="printer_queue")
    op.drop_table("printer_queue")
    op.drop_table("print_task_printers")
    op.drop_table("printer_shares")
    op.drop_index("ix_printers_current_task_id", table_name="printers")
    op.drop_index("ix_printers_owner_id", table_name="printers")
    op.drop_table("printers")
    op.drop_index("ix_print_tasks_file_id", table_name="print_tasks")
    op.drop_index("ix_print_tasks_job_id", table_name="print_tasks")
    op.drop_table("print_tasks")
    op.drop_index("ix_print_jobs_created_by", table_name="print_jobs")
    op.drop_table("print_jobs")
    op.drop_index("ix_stl_files_uploaded_by", table_name="stl_files")
    op.drop_table("stl_files")
    op.drop_column("users", "preferences")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "user_name")
