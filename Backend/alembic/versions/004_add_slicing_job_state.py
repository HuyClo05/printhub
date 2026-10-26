"""add persistent slicing job state

Revision ID: 004_add_slicing_job_state
Revises: 003_simplify_initial_workflow
Create Date: 2026-09-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004_add_slicing_job_state"
down_revision: Union[str, Sequence[str], None] = "003_simplify_initial_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_print_jobs_status", "print_jobs", type_="check")
    op.create_check_constraint(
        "ck_print_jobs_status",
        "print_jobs",
        "status IN ('pending', 'queued', 'slicing', 'in-progress', 'completed', 'failed', 'cancelled')",
    )

    op.add_column("print_tasks", sa.Column("printer_profile", sa.String(length=255), nullable=True))
    op.add_column("print_tasks", sa.Column("process_profile", sa.String(length=255), nullable=True))
    op.add_column("print_tasks", sa.Column("filament_profile", sa.String(length=255), nullable=True))
    op.add_column("print_tasks", sa.Column("arrange", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("print_tasks", sa.Column("orient", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("print_tasks", sa.Column("gcode_key", sa.String(length=2048), nullable=True))
    op.add_column("print_tasks", sa.Column("error_message", sa.String(length=4000), nullable=True))
    op.add_column("print_tasks", sa.Column("print_time_seconds", sa.Integer(), nullable=True))
    op.add_column("print_tasks", sa.Column("filament_used_g", sa.Float(), nullable=True))
    op.add_column("print_tasks", sa.Column("filament_used_mm", sa.Float(), nullable=True))


def downgrade() -> None:
    for column in (
        "filament_used_mm",
        "filament_used_g",
        "print_time_seconds",
        "error_message",
        "gcode_key",
        "orient",
        "arrange",
        "filament_profile",
        "process_profile",
        "printer_profile",
    ):
        op.drop_column("print_tasks", column)

    op.drop_constraint("ck_print_jobs_status", "print_jobs", type_="check")
    op.create_check_constraint(
        "ck_print_jobs_status",
        "print_jobs",
        "status IN ('pending', 'in-progress', 'completed', 'cancelled')",
    )
