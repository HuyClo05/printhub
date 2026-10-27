"""Authenticated model-upload and persistent slicing-job endpoints."""

from __future__ import annotations

import json
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import Principal, get_current_principal
from app.config import slicer_data_path
from app.db import get_db
from app.models import IdempotencyRecord, PrintJob, PrintTask, SlicerProfileVersion, StlFile, User
from app.profile_import import ProfileBundleError, import_orca_bundle
from app.profile_versions import (
    ProfileVersionError,
    create_profile_version,
    latest_profile_version,
    validate_process_printer_compatibility,
)
from app.schemas import (
    ModelFileResponse,
    ProfileListResponse,
    ProfileDetailResponse,
    SlicerProfileCreate,
    SlicerProfileRestore,
    SlicerProfileVersionResponse,
    SliceJobCreate,
    SliceJobResponse,
    UploadUrlCreate,
    UploadUrlResponse,
)
from app.slicer import SlicerClient, SlicerError
from app.storage import get_bytes, head_object, presigned_put_url


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["slicing"])
PROFILE_CATEGORIES = {"printers", "presets", "filaments"}


@router.post("/files/upload-url", response_model=UploadUrlResponse, status_code=201)
def create_model_upload_url(
    request: UploadUrlCreate,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> UploadUrlResponse:
    """Create a short-lived, object-scoped signed URL for a direct model upload."""

    filename = Path(request.file_name).name
    if filename != request.file_name or Path(filename).suffix.lower() not in {".stl", ".3mf"}:
        raise HTTPException(status_code=415, detail="Upload a prepared STL or 3MF model")
    ensure_user(db, principal)
    file_id = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    object_key = f"users/{principal.subject}/models/{file_id}/{filename}"
    model = StlFile(
        id=file_id,
        file_name=filename,
        file_size=request.file_size,
        content_type=request.content_type,
        sha256=request.sha256.lower(),
        upload_status="pending",
        upload_expires_at=expires_at,
        stl_url=object_key,
        uploaded_by=principal.subject,
        uploaded_at=datetime.now(timezone.utc),
    )
    upload_url = presigned_put_url(object_key, request.content_type, expires_seconds=600)
    db.add(model)
    db.commit()
    return UploadUrlResponse(
        file_id=file_id,
        upload_url=upload_url,
        expires_at=expires_at,
    )


@router.post("/files/{file_id}/complete", response_model=ModelFileResponse)
def complete_model_upload(
    file_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> StlFile:
    """Verify that a direct object-store upload exists before it can be sliced."""

    model = db.scalar(
        select(StlFile).where(
            StlFile.id == file_id,
            StlFile.uploaded_by == principal.subject,
        )
    )
    if model is None:
        raise HTTPException(status_code=404, detail="Upload target not found")
    if model.upload_status == "ready":
        return model
    try:
        metadata = head_object(model.stl_url or "")
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=409, detail="The signed upload has not completed") from error
    if metadata.get("ContentLength") != model.file_size:
        raise HTTPException(status_code=400, detail="Uploaded size does not match the signed request")
    model.upload_status = "ready"
    db.commit()
    db.refresh(model)
    return model


@router.get("/slicer/profiles/{category}", response_model=ProfileListResponse)
def list_slicer_profiles(
    category: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ProfileListResponse:
    """List the authenticated user's versioned profiles without leaking other users' names."""

    if category not in PROFILE_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown slicer profile category")
    profiles = list(
        db.scalars(
            select(SlicerProfileVersion.name)
            .where(
                SlicerProfileVersion.owner_id == principal.subject,
                SlicerProfileVersion.category == category,
            )
            .distinct()
            .order_by(SlicerProfileVersion.name)
        )
    )
    return ProfileListResponse(category=category, profiles=profiles)


@router.get("/slicer/profiles/{category}/{profile_name}", response_model=ProfileDetailResponse)
def get_slicer_profile(
    category: str,
    profile_name: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ProfileDetailResponse:
    """Return an imported profile's settings for the slicer workspace."""

    if category not in PROFILE_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown slicer profile category")
    if not profile_name or Path(profile_name).name != profile_name:
        raise HTTPException(status_code=400, detail="Invalid profile name")

    version = db.scalar(
        select(SlicerProfileVersion)
        .where(
            SlicerProfileVersion.owner_id == principal.subject,
            SlicerProfileVersion.category == category,
            SlicerProfileVersion.name == profile_name,
        )
        .order_by(SlicerProfileVersion.version.desc())
        .limit(1)
    )
    if version is None:
        raise HTTPException(status_code=404, detail="Slicer profile not found")
    return ProfileDetailResponse(category=category, name=profile_name, settings=version.settings)


@router.get("/slicer/profiles/{category}/{profile_name}/resolved", response_model=ProfileDetailResponse)
async def get_resolved_slicer_profile(
    category: str,
    profile_name: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> ProfileDetailResponse:
    """Return a profile merged with its whole inherits chain (user profiles first, then system)."""

    if category not in PROFILE_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown slicer profile category")
    if not profile_name or Path(profile_name).name != profile_name:
        raise HTTPException(status_code=400, detail="Invalid profile name")
    chain: list[dict] = []
    name: object = profile_name
    seen: set[str] = set()
    try:
        while isinstance(name, str) and name and name not in seen and len(seen) < 16:
            seen.add(name)
            try:
                settings = latest_profile_version(db, owner_id=principal.subject, category=category, name=name).settings
            except ProfileVersionError:
                # System profiles resolve their own chain inside the slicer service.
                settings = await SlicerClient().resolved_profile(category, name)
                if settings is not None:
                    chain.append(settings)
                break
            chain.append(settings)
            name = settings.get("inherits")
    except (SlicerError, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail="Slicer profile lookup failed") from error
    if not chain:
        raise HTTPException(status_code=404, detail="Slicer profile not found")
    resolved: dict = {}
    for settings in reversed(chain):
        resolved.update(settings)
    return ProfileDetailResponse(category=category, name=profile_name, settings=resolved)


@router.post("/slicer/profile-bundles", status_code=201)
async def import_profile_bundle(
    bundle: UploadFile = File(...),
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> dict[str, list[str]]:
    """Import a bundle and append immutable versions for every contained profile."""

    filename = (bundle.filename or "").lower()
    if not filename.endswith((".orca_printer", ".zip")):
        raise HTTPException(status_code=415, detail="Upload an .orca_printer or .zip bundle")
    content = await bundle.read(25 * 1024 * 1024 + 1)
    try:
        imported = import_orca_bundle(content)
    except ProfileBundleError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    ensure_user(db, principal)
    bundle_sha256 = hashlib.sha256(content).hexdigest()
    try:
        for category, names in imported.items():
            for name in names:
                path = Path(slicer_data_path()) / category / f"{name}.json"
                settings = json.loads(path.read_text(encoding="utf-8"))
                create_profile_version(
                    db,
                    owner_id=principal.subject,
                    category=category,
                    name=name,
                    settings=settings,
                    source_bundle_sha256=bundle_sha256,
                )
        db.commit()
    except (OSError, json.JSONDecodeError, ProfileVersionError) as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001
        db.rollback()
        logger.exception("Could not persist imported profile versions")
        raise HTTPException(status_code=502, detail="Could not persist profile versions") from error
    return imported


@router.post("/profiles", response_model=SlicerProfileVersionResponse, status_code=201)
def create_slicer_profile(
    request: SlicerProfileCreate,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SlicerProfileVersion:
    ensure_user(db, principal)
    try:
        version, _created = create_profile_version(
            db,
            owner_id=principal.subject,
            category=request.category,
            name=request.name,
            settings=request.settings,
            note=request.note,
        )
        db.commit()
        db.refresh(version)
        return version
    except ProfileVersionError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/profiles/{version_id}/restore", response_model=SlicerProfileVersionResponse, status_code=201)
def restore_profile_version(
    version_id: str,
    request: SlicerProfileRestore,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SlicerProfileVersion:
    """Append a copy of an older version as the newest one; history is never rewritten."""

    source = db.scalar(
        select(SlicerProfileVersion).where(
            SlicerProfileVersion.id == version_id,
            SlicerProfileVersion.owner_id == principal.subject,
        )
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Profile version not found")
    try:
        version, _created = create_profile_version(
            db,
            owner_id=principal.subject,
            category=source.category,
            name=source.name,
            settings=source.settings,
            note=request.note or f"Restored from v{source.version}",
            restored_from_id=source.id,
        )
        db.commit()
        db.refresh(version)
        return version
    except ProfileVersionError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/profiles", response_model=list[SlicerProfileVersionResponse])
def list_profile_versions(
    category: str | None = None,
    name: str | None = None,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[SlicerProfileVersion]:
    query = select(SlicerProfileVersion).where(SlicerProfileVersion.owner_id == principal.subject)
    if category:
        query = query.where(SlicerProfileVersion.category == category)
    if name:
        query = query.where(SlicerProfileVersion.name == name)
    return list(
        db.scalars(
            query
            .order_by(
                SlicerProfileVersion.category,
                SlicerProfileVersion.name,
                SlicerProfileVersion.version.desc(),
            )
        )
    )


@router.post("/slice-jobs", response_model=SliceJobResponse, status_code=202)
def create_slice_job(
    request: SliceJobCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=255),
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SliceJobResponse:
    """Create a persistent slicing job and start it after the response returns."""

    ensure_user(db, principal)
    request_hash = hashlib.sha256(
        request.model_dump_json(exclude_none=False).encode("utf-8")
    ).hexdigest()
    if idempotency_key:
        existing = db.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.owner_id == principal.subject,
                IdempotencyRecord.endpoint == "POST /api/v1/slice-jobs",
                IdempotencyRecord.key == idempotency_key,
            )
        )
        if existing is not None:
            if existing.request_hash != request_hash:
                raise HTTPException(status_code=409, detail="Idempotency-Key was already used for another request")
            existing_job, existing_task = owned_job(db, existing.resource_id, principal.subject)
            return to_slice_response(existing_job, existing_task)
    model = db.scalar(
        select(StlFile).where(
            StlFile.id == request.file_id,
            StlFile.uploaded_by == principal.subject,
        )
    )
    if model is None or model.upload_status != "ready":
        raise HTTPException(status_code=404, detail="Model file not found")

    try:
        printer_version = latest_profile_version(
            db, owner_id=principal.subject, category="printers", name=request.printer_profile
        )
        process_version = latest_profile_version(
            db, owner_id=principal.subject, category="presets", name=request.process_profile
        )
        filament_version = latest_profile_version(
            db, owner_id=principal.subject, category="filaments", name=request.filament_profile
        )
        versions = [printer_version, process_version, filament_version]
        for index, (category, version_id) in enumerate(zip(("printers", "presets", "filaments"), (request.printer_profile_version_id, request.process_profile_version_id, request.filament_profile_version_id))):
            if version_id:
                selected = db.scalar(select(SlicerProfileVersion).where(SlicerProfileVersion.id == version_id, SlicerProfileVersion.owner_id == principal.subject, SlicerProfileVersion.category == category, SlicerProfileVersion.name == versions[index].name))
                if selected is None:
                    raise ProfileVersionError("Selected profile version not found")
                versions[index] = selected
        printer_version, process_version, filament_version = versions
        if request.process_overrides:
            # Persist edited settings as a real immutable version before the
            # queue references it. Ownership and the category stay server-side.
            settings = {**process_version.settings, **request.process_overrides}
            process_version, _ = create_profile_version(db, owner_id=principal.subject, category="presets", name=process_version.name, settings=settings, note="Saved when slicing with unsaved changes")
    except ProfileVersionError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(error)) from error

    try:
        validate_process_printer_compatibility(printer_version, process_version)
    except ProfileVersionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    extra_filaments = []
    try:
        for name in request.filament_profiles:
            extra_filaments.append(latest_profile_version(db, owner_id=principal.subject, category="filaments", name=name).id)
        if request.calibration:
            from app.calibration import validate_calibration
            validate_calibration(request.calibration.model_dump(), printer_version.settings)
    except (ProfileVersionError, ValueError) as error:
        raise HTTPException(400, str(error)) from error

    job_id = str(uuid4())
    now = datetime.now(timezone.utc)
    job = PrintJob(
        id=job_id,
        created_by=principal.subject,
        job_name=model.file_name,
        status="queued",
        created_at=now,
    )
    task = PrintTask(
        id=str(uuid4()),
        job_id=job_id,
        file_id=model.id,
        status="queued",
        created_at=now,
        printer_profile=request.printer_profile,
        process_profile=request.process_profile,
        filament_profile=request.filament_profile,
        printer_profile_version_id=printer_version.id,
        process_profile_version_id=process_version.id,
        filament_profile_version_id=filament_version.id,
        arrange=request.arrange,
        orient=request.orient,
        slice_options={"filament_versions": extra_filaments, "calibration": request.calibration.model_dump() if request.calibration else None},
        available_at=now,
        attempt_count=0,
        max_attempts=5,
    )
    db.add_all([job, task])
    if idempotency_key:
        db.add(
            IdempotencyRecord(
                owner_id=principal.subject,
                endpoint="POST /api/v1/slice-jobs",
                key=idempotency_key,
                request_hash=request_hash,
                resource_id=job_id,
                created_at=now,
            )
        )
    db.commit()
    return to_slice_response(job, task)


@router.get("/slice-jobs/{job_id}", response_model=SliceJobResponse)
def get_slice_job(
    job_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> SliceJobResponse:
    job, task = owned_job(db, job_id, principal.subject)
    return to_slice_response(job, task)


@router.get("/slice-jobs/{job_id}/gcode")
def download_gcode(
    job_id: str,
    principal: Principal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Response:
    _job, task = owned_job(db, job_id, principal.subject)
    if task.status != "completed" or not task.gcode_key:
        raise HTTPException(status_code=409, detail="G-code is not ready")
    try:
        content = get_bytes(task.gcode_key)
    except Exception as error:  # noqa: BLE001 - translate storage failures at the API boundary
        raise HTTPException(status_code=502, detail="Object storage could not read the G-code") from error
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{job_id}.gcode"'},
    )


def owned_job(db: Session, job_id: str, owner_id: str | None) -> tuple[PrintJob, PrintTask]:
    statement = select(PrintJob, PrintTask).join(PrintTask, PrintTask.job_id == PrintJob.id).where(PrintJob.id == job_id)
    if owner_id is not None:
        statement = statement.where(PrintJob.created_by == owner_id)
    row = db.execute(statement).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Slice job not found")
    return row[0], row[1]


def ensure_user(db: Session, principal: Principal) -> User:
    user = db.get(User, principal.subject)
    if user is None:
        user = User(
            id=principal.subject,
            email=principal.email or f"{principal.subject}@local.invalid",
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.flush()
    return user


def to_slice_response(job: PrintJob, task: PrintTask) -> SliceJobResponse:
    return SliceJobResponse(
        id=job.id,
        file_id=task.file_id,
        status=job.status,
        printer_profile=task.printer_profile,
        process_profile=task.process_profile,
        filament_profile=task.filament_profile,
        printer_profile_version_id=task.printer_profile_version_id,
        process_profile_version_id=task.process_profile_version_id,
        filament_profile_version_id=task.filament_profile_version_id,
        arrange=task.arrange,
        orient=task.orient,
        print_time_seconds=task.print_time_seconds,
        filament_used_g=task.filament_used_g,
        filament_used_mm=task.filament_used_mm,
        error_message=task.error_message,
        attempt_count=task.attempt_count,
        max_attempts=task.max_attempts,
        model_sha256=task.file.sha256 if task.file is not None else None,
        gcode_sha256=task.gcode_sha256,
        dead_lettered_at=task.dead_lettered_at,
    )
