"""A single STL-based print task belonging to a print job."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


class PrintTask(Base):
    __tablename__ = "print_tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'slicing', 'queued', 'retrying', 'printing', 'in-progress', 'completed', 'failed', 'dead-lettered', 'cancelled')",
            name="ck_print_tasks_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("print_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("stl_files.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    estimated_print_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    printer_profile: Mapped[str | None] = mapped_column(String(255), nullable=True)
    process_profile: Mapped[str | None] = mapped_column(String(255), nullable=True)
    filament_profile: Mapped[str | None] = mapped_column(String(255), nullable=True)
    printer_profile_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("slicer_profile_versions.id", ondelete="RESTRICT"), nullable=True
    )
    process_profile_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("slicer_profile_versions.id", ondelete="RESTRICT"), nullable=True
    )
    filament_profile_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("slicer_profile_versions.id", ondelete="RESTRICT"), nullable=True
    )
    arrange: Mapped[bool] = mapped_column(nullable=False, default=False)
    orient: Mapped[bool] = mapped_column(nullable=False, default=False)
    slice_options: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    gcode_key: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    gcode_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    print_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    filament_used_g: Mapped[float | None] = mapped_column(nullable=True)
    filament_used_mm: Mapped[float | None] = mapped_column(nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lease_owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dead_lettered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    job: Mapped["PrintJob"] = relationship(back_populates="tasks")
    file: Mapped["StlFile"] = relationship(back_populates="tasks")
