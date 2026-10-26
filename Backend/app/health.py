"""Dependency checks used by the liveness and readiness endpoints."""

from __future__ import annotations

import logging
from typing import Any

import boto3
from sqlalchemy import text

from app.config import s3_bucket, s3_endpoint, s3_region, setting
from app.db import engine

logger = logging.getLogger(__name__)


def check_database() -> tuple[bool, str | None]:
    """Confirm that PostgreSQL accepts a simple query."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, None
    except Exception as error:  # noqa: BLE001 - health checks must not crash the API
        logger.warning("Database readiness check failed: %s", error)
        return False, str(error)


def check_object_storage() -> tuple[bool, str | None]:
    """Confirm that the configured S3-compatible bucket is reachable."""

    try:
        client = boto3.client(
            "s3",
            endpoint_url=s3_endpoint(),
            region_name=s3_region(),
            aws_access_key_id=setting("S3_ACCESS_KEY"),
            aws_secret_access_key=setting("S3_SECRET_KEY"),
        )
        client.head_bucket(Bucket=s3_bucket())
        return True, None
    except Exception as error:  # noqa: BLE001 - health checks must not crash the API
        logger.warning("Object-storage readiness check failed: %s", error)
        return False, str(error)


def readiness_report() -> dict[str, Any]:
    """Return dependency status without exposing credentials."""

    database_ok, _database_error = check_database()
    storage_ok, _storage_error = check_object_storage()

    report: dict[str, Any] = {
        "status": "ok" if database_ok and storage_ok else "not_ready",
        "checks": {
            "database": "ok" if database_ok else "failed",
            "object_storage": "ok" if storage_ok else "failed",
        },
    }

    return report
