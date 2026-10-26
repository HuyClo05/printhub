"""Print-job batch model."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class PrintJob(Base):
    __tablename__ = "print_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'queued', 'slicing', 'retrying', 'in-progress', 'completed', 'failed', 'dead-lettered', 'cancelled')",
            name="ck_print_jobs_status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creator: Mapped["User"] = relationship(back_populates="print_jobs")
    tasks: Mapped[list["PrintTask"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
