"""Environment-backed configuration for the PrintHub API."""

from __future__ import annotations

import os


def setting(name: str, default: str | None = None) -> str | None:
    """Read one setting from the process environment."""

    return os.getenv(name, default)


def s3_endpoint() -> str | None:
    """Return the S3-compatible endpoint.

    Local SeaweedFS uses an explicit endpoint. AWS S3 uses ``None`` so boto3
    selects the normal regional S3 endpoint.
    """

    return setting("S3_ENDPOINT")


def s3_bucket() -> str:
    """Return the object-storage bucket used by PrintHub."""

    return setting("S3_BUCKET", "printhub-artifacts") or "printhub-artifacts"


def s3_region() -> str:
    """Return the object-storage region."""

    return setting("AWS_REGION", "us-east-1") or "us-east-1"


def oidc_issuer() -> str:
    """Return the expected OIDC issuer URL."""

    value = setting("OIDC_ISSUER")
    if not value:
        raise RuntimeError("OIDC_ISSUER is not configured")
    return value.rstrip("/")


def oidc_jwks_url() -> str:
    """Return the identity provider's JSON Web Key Set URL."""

    configured = setting("OIDC_JWKS_URL")
    if configured:
        return configured
    return f"{oidc_issuer()}/protocol/openid-connect/certs"


def oidc_audience() -> str | None:
    """Return the expected token audience when one is configured."""

    value = setting("OIDC_AUDIENCE")
    return value or None


def slicer_data_path() -> str:
    """Return the shared profile directory mounted into the API container."""

    return setting("SLICER_DATA_PATH", "/slicer-data") or "/slicer-data"


def frontend_url() -> str:
    """Return the externally reachable base URL used in signed upload links."""

    return (setting("FRONTEND_URL", "http://localhost:8080") or "http://localhost:8080").rstrip("/")


def worker_lease_seconds() -> int:
    return max(int(setting("WORKER_LEASE_SECONDS", "90") or "90"), 30)


def worker_poll_seconds() -> float:
    return max(float(setting("WORKER_POLL_SECONDS", "2") or "2"), 0.2)


def worker_retry_base_seconds() -> int:
    return max(int(setting("WORKER_RETRY_BASE_SECONDS", "5") or "5"), 1)
