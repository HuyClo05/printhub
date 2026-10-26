"""User database model."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    """An authenticated PrintHub user."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    profile: Mapped["Profile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    resources: Mapped[list["Resource"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    printers: Mapped[list["Printer"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    print_jobs: Mapped[list["PrintJob"]] = relationship(
        back_populates="creator", cascade="all, delete-orphan"
    )
    stl_files: Mapped[list["StlFile"]] = relationship(
        back_populates="uploader", cascade="all, delete-orphan"
    )
