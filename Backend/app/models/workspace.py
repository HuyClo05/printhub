"""Durable printer pairing and outbound agent commands."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PrinterConnection(Base):
    __tablename__ = "printer_connections"
    printer_id: Mapped[str] = mapped_column(String(36), ForeignKey("printers.id", ondelete="CASCADE"), primary_key=True)
    host_type: Mapped[str] = mapped_column(String(24), nullable=False)
    profile_name: Mapped[str | None] = mapped_column(String(255))
    pairing_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    pairing_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    telemetry: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class PrinterCommand(Base):
    __tablename__ = "printer_commands"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    printer_id: Mapped[str] = mapped_column(String(36), ForeignKey("printers.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="queued")
    error_message: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
