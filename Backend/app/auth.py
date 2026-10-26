"""Bearer-token authentication for OIDC providers such as Keycloak."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError

from app.config import oidc_audience, oidc_issuer, oidc_jwks_url


logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    """The identity extracted from a validated access token."""

    subject: str
    email: str | None
    issuer: str


def authentication_error() -> HTTPException:
    """Return the standard response for missing or invalid credentials."""

    return HTTPException(
        status_code=401,
        detail="Invalid or missing bearer token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    """Validate the bearer token against the configured OIDC JWKS endpoint."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    try:
        issuer = oidc_issuer()
        audience = oidc_audience()
        jwks_client = PyJWKClient(oidc_jwks_url())
        signing_key = jwks_client.get_signing_key_from_jwt(credentials.credentials)

        decode_options = {"require": ["exp", "sub"], "verify_aud": audience is not None}
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=audience,
            options=decode_options,
        )

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject:
            raise authentication_error()

        email = claims.get("email")
        return Principal(
            subject=subject,
            email=email if isinstance(email, str) else None,
            issuer=issuer,
        )
    except HTTPException:
        raise
    except (PyJWTError, PyJWKClientError, OSError, RuntimeError) as error:
        logger.warning("Bearer-token validation failed: %s", error)
        raise authentication_error() from error
