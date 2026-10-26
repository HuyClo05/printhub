"""FastAPI entry point for the PrintHub control plane."""

from fastapi import FastAPI
from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import Principal, get_current_principal
from app.db import get_db
from app.health import readiness_report
from app.models import Resource
from app.schemas import MeResponse, ResourceResponse
from app.slicing_routes import router as slicing_router
from app.workspace_routes import router as workspace_router


app = FastAPI(title="PrintHub API", version="0.1.0")
app.include_router(slicing_router)
app.include_router(workspace_router)


@app.get("/health/live", tags=["health"])
def live() -> dict[str, str]:
    """Report that the API process is running."""

    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def ready() -> JSONResponse:
    """Report whether PostgreSQL and object storage are reachable."""

    report = readiness_report()
    status_code = 200 if report["status"] == "ok" else 503
    return JSONResponse(status_code=status_code, content=report)


@app.get("/api/v1/me", response_model=MeResponse, tags=["identity"])
def me(principal: Principal = Depends(get_current_principal)) -> MeResponse:
    """Return the identity represented by the validated bearer token."""

    return MeResponse(
        id=principal.subject,
        email=principal.email,
        issuer=principal.issuer,
    )


@app.get(
    "/api/v1/resources/{resource_id}",
    response_model=ResourceResponse,
    tags=["resources"],
)
def get_resource(
    resource_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Resource:
    """Return a resource only when it belongs to the current user."""

    resource = db.scalar(
        select(Resource).where(
            Resource.id == resource_id,
            Resource.owner_id == principal.subject,
        )
    )
    if resource is None:
        # Do not reveal whether the ID exists for another user.
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource
