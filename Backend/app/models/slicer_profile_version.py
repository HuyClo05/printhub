"""Immutable OrcaSlicer profile versions owned by PrintHub users."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SlicerProfileVersion(Base):
    __tablename__ = "slicer_profile_versions"
    __table_args__ = (
        CheckConstraint(
            "category IN ('printers', 'presets', 'filaments')",
            name="ck_slicer_profile_versions_category",
        ),
        UniqueConstraint(
            "owner_id", "category", "name", "version",
            name="uq_slicer_profile_versions_owner_name_version",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    object_key: Mapped[str] = mapped_column(String(2048), nullable=False)
    source_bundle_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    restored_from_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("slicer_profile_versions.id", ondelete="SET NULL"), nullable=True
    )
