"""Database metadata and engine configuration for the PrintHub backend."""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Base class used by all SQLAlchemy models."""


def database_url() -> str:
    """Return the configured database URL."""

    return os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://printhub:change-me@localhost:5432/printhub",
    )


engine = create_engine(database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """Yield one database session per request."""

    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
