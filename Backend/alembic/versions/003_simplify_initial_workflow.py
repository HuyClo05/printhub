"""add profiles and remove deferred workflow structures

Revision ID: 003_simplify_initial_workflow
Revises: 002_print_workflow_schema
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "003_simplify_initial_workflow"
down_revision: Union[str, Sequence[str], None] = "002_print_workflow_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Profiles are separate from identity records. Preserve the profile-like
    # values that were previously stored on users before removing those columns.
    op.create_table(
        "profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO profiles
                (id, user_id, display_name, avatar_url, preferences, created_at, updated_at)
            SELECT
                md5('profile:' || id), id, user_name, avatar_url, preferences,
                created_at, CURRENT_TIMESTAMP
            FROM users
            """
        )
    )

    op.drop_column("users", "preferences")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "user_name")

    # Sharing, multi-printer assignment, and queue management are deferred
    # until the printer agent and job APIs are implemented.
    op.drop_index("ix_printer_queue_job_id", table_name="printer_queue")
    op.drop_table("printer_queue")
    op.drop_table("print_task_printers")
    op.drop_table("printer_shares")
    op.drop_constraint("fk_printers_current_task_id", "printers", type_="foreignkey")

    for column in (
        "current_task_id",
        "octoeverywhere_url",
        "printer_presets",
        "process_presets",
        "filament_presets",
        "nozzle_temp",
        "nozzle_temp_target",
        "bed_temp",
        "bed_temp_target",
        "fan_speed",
        "webcam",
    ):
        op.drop_column("printers", column)

    for column in ("estimated_end_at", "total_tasks", "completed_tasks", "failed_tasks"):
        op.drop_column("print_jobs", column)


def downgrade() -> None:
    for name, column, default in (
        ("print_jobs", "failed_tasks", "0"),
        ("print_jobs", "completed_tasks", "0"),
        ("print_jobs", "total_tasks", "0"),
    ):
        op.add_column("print_jobs", sa.Column(column, sa.Integer(), nullable=False, server_default=default))
    op.add_column("print_jobs", sa.Column("estimated_end_at", sa.DateTime(timezone=True), nullable=True))

    for column, type_ in (
        ("current_task_id", sa.String(length=36)),
        ("webcam", sa.String(length=2048)),
        ("fan_speed", sa.Integer()),
        ("bed_temp_target", sa.Float()),
        ("bed_temp", sa.Float()),
        ("nozzle_temp_target", sa.Float()),
        ("nozzle_temp", sa.Float()),
        ("filament_presets", postgresql.JSONB(astext_type=sa.Text())),
        ("process_presets", postgresql.JSONB(astext_type=sa.Text())),
        ("printer_presets", postgresql.JSONB(astext_type=sa.Text())),
        ("octoeverywhere_url", sa.String(length=2048)),
    ):
        op.add_column("printers", sa.Column(column, type_, nullable=True))

    op.create_foreign_key(
        "fk_printers_current_task_id",
        "printers",
        "print_tasks",
        ["current_task_id"],
        ["id"],
        ondelete="SET NULL",
    )

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
    )
    op.create_index("ix_printer_queue_job_id", "printer_queue", ["job_id"])

    op.add_column("users", sa.Column("user_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column("users", sa.Column("preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.execute(
        sa.text(
            "UPDATE users u SET user_name = p.display_name, avatar_url = p.avatar_url, preferences = p.preferences FROM profiles p WHERE p.user_id = u.id"
        )
    )
    op.drop_table("profiles")
