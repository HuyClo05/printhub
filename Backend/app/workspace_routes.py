"""Owner-scoped workspace history, profile versions and printer agent API."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import Principal, get_current_principal
from app.db import get_db
from app.models import Printer, PrintJob, PrintTask, SlicerProfileVersion, StlFile
from app.models.workspace import PrinterCommand, PrinterConnection
from app.slicing_routes import ensure_user, owned_job, to_slice_response
from app.storage import get_bytes, presigned_get_url

router = APIRouter(prefix="/api/v1", tags=["workspace"])


def now():
    return datetime.now(timezone.utc)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@router.get("/slice-jobs")
def jobs(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)):
    rows = db.execute(select(PrintJob, PrintTask).join(PrintTask).where(PrintJob.created_by == principal.subject).order_by(PrintJob.created_at.desc()).limit(limit))
    return [{**to_slice_response(job, task).model_dump(), "name": job.job_name, "created_at": job.created_at} for job, task in rows]


@router.post("/slice-jobs/{job_id}/cancel")
def cancel(job_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    job, task = owned_job(db, job_id, principal.subject)
    if task.status == "completed":
        raise HTTPException(409, "Completed slices cannot be cancelled")
    job.status = task.status = "cancelled"
    task.lease_owner = task.lease_expires_at = None
    task.completed_at = job.completed_at = now()
    db.commit()
    return to_slice_response(job, task)


@router.post("/slice-jobs/{job_id}/retry")
def retry(job_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    job, task = owned_job(db, job_id, principal.subject)
    if task.status not in {"failed", "dead-lettered", "cancelled"}:
        raise HTTPException(409, "Only failed or cancelled slices can be retried")
    task.status = job.status = "queued"
    task.attempt_count = 0
    task.error_message = task.dead_lettered_at = task.completed_at = task.started_at = None
    task.lease_owner = task.lease_expires_at = None
    task.available_at = now()
    job.completed_at = job.started_at = None
    db.commit()
    return to_slice_response(job, task)


@router.get("/files")
def files(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    rows = db.scalars(select(StlFile).where(StlFile.uploaded_by == principal.subject, StlFile.upload_status == "ready").order_by(StlFile.uploaded_at.desc()).limit(200))
    return [{"id": row.id, "name": row.file_name, "size": row.file_size, "created_at": row.uploaded_at} for row in rows]


@router.get("/files/{file_id}/content")
def model_content(file_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    row = db.scalar(select(StlFile).where(StlFile.id == file_id, StlFile.uploaded_by == principal.subject, StlFile.upload_status == "ready"))
    if row is None:
        raise HTTPException(404, "Model not found")
    return Response(get_bytes(row.stl_url), media_type=row.content_type or "application/octet-stream", headers={"Content-Disposition": f"attachment; filename*=UTF-8''{__import__('urllib.parse', fromlist=['quote']).quote(row.file_name)}"})


@router.get("/profiles/{version_id}")
def profile_version(version_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    row = db.scalar(select(SlicerProfileVersion).where(SlicerProfileVersion.id == version_id, SlicerProfileVersion.owner_id == principal.subject))
    if row is None:
        raise HTTPException(404, "Profile version not found")
    return {"id": row.id, "name": row.name, "category": row.category, "version": row.version, "settings": row.settings, "sha256": row.sha256}


class PrinterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    model: str = Field(default="", max_length=255)
    host_type: Literal["moonraker", "octoprint", "simulator"] = "moonraker"
    profile_name: str = Field(default="", max_length=255)


def owned_printer(db, printer_id, owner):
    row = db.execute(select(Printer, PrinterConnection).join(PrinterConnection).where(Printer.id == printer_id, Printer.owner_id == owner).with_for_update()).first()
    if row is None:
        raise HTTPException(404, "Printer not found")
    return row


def printer_info(printer, connection):
    online = printer.last_seen is not None and (now() - printer.last_seen).total_seconds() < 45
    return {"id": printer.id, "name": printer.name, "model": printer.model, "host_type": connection.host_type, "profile_name": connection.profile_name, "state": printer.state if online else "offline", "last_seen": printer.last_seen, "paired": bool(connection.token_hash), "telemetry": connection.telemetry if online else {}}


@router.get("/printers")
def printers(principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    return [printer_info(p, c) for p, c in db.execute(select(Printer, PrinterConnection).join(PrinterConnection).where(Printer.owner_id == principal.subject).order_by(Printer.name))]


@router.post("/printers", status_code=201)
def register_printer(request: PrinterCreate, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    ensure_user(db, principal)
    printer = Printer(owner_id=principal.subject, name=request.name.strip(), model=request.model, state="offline", created_at=now())
    db.add(printer)
    db.flush()
    connection = PrinterConnection(printer_id=printer.id, host_type=request.host_type, profile_name=request.profile_name, telemetry={})
    db.add(connection)
    db.commit()
    return printer_info(printer, connection)


@router.delete("/printers/{printer_id}", status_code=204)
def remove_printer(printer_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    printer, connection = owned_printer(db, printer_id, principal.subject)
    if printer.state in {"printing", "paused"}:
        raise HTTPException(409, "Stop the print before removing its printer")
    db.delete(printer)
    db.commit()


@router.post("/printers/{printer_id}/pair")
def pair(printer_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    printer, connection = owned_printer(db, printer_id, principal.subject)
    code = secrets.token_urlsafe(24)
    connection.pairing_hash = digest(code)
    connection.pairing_expires_at = now() + timedelta(minutes=10)
    # Re-pairing revokes the previous agent immediately.
    connection.token_hash = None
    db.commit()
    return {"code": code, "expires_at": connection.pairing_expires_at}


class Redeem(BaseModel):
    code: str = Field(min_length=20, max_length=100)


@router.post("/agent/pair")
def redeem(request: Redeem, db: Session = Depends(get_db)):
    connection = db.scalar(select(PrinterConnection).where(PrinterConnection.pairing_hash == digest(request.code)).with_for_update())
    if connection is None or connection.pairing_expires_at < now():
        raise HTTPException(401, "Pairing code expired or already redeemed")
    token = secrets.token_urlsafe(48)
    connection.token_hash = digest(token)
    connection.pairing_hash = connection.pairing_expires_at = None
    db.commit()
    return {"token": token, "printer_id": connection.printer_id, "host_type": connection.host_type}


def agent(db, authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Agent bearer token required")
    row = db.execute(select(Printer, PrinterConnection).join(PrinterConnection).where(PrinterConnection.token_hash == digest(authorization[7:]))).first()
    if row is None:
        raise HTTPException(401, "Agent token is invalid")
    return row


class Heartbeat(BaseModel):
    state: Literal["ready", "printing", "paused", "error", "offline"]
    telemetry: dict = Field(default_factory=dict)


@router.post("/agent/heartbeat")
def heartbeat(request: Heartbeat, authorization: str | None = Header(None), db: Session = Depends(get_db)):
    printer, connection = agent(db, authorization)
    printer.state, printer.last_seen = request.state, now()
    if len(__import__('json').dumps(request.telemetry)) > 1_500_000:
        raise HTTPException(413, "Telemetry is too large")
    connection.telemetry = request.telemetry
    commands = list(db.scalars(select(PrinterCommand).where(PrinterCommand.printer_id == printer.id, PrinterCommand.status == "queued").order_by(PrinterCommand.created_at).with_for_update(skip_locked=True).limit(1)))
    result = []
    for command in commands:
        command.status, command.delivered_at = "delivered", now()
        payload = dict(command.payload)
        if command.action == "print":
            _job, task = owned_job(db, payload["job_id"], printer.owner_id)
            payload["download_url"] = presigned_get_url(task.gcode_key)
        result.append({"id": command.id, "action": command.action, "payload": payload})
    db.commit()
    return {"commands": result}


class CommandResult(BaseModel):
    status: Literal["completed", "failed"]
    error: str = Field(default="", max_length=2000)


@router.post("/agent/commands/{command_id}")
def acknowledge(command_id: str, request: CommandResult, authorization: str | None = Header(None), db: Session = Depends(get_db)):
    printer, _connection = agent(db, authorization)
    command = db.scalar(select(PrinterCommand).where(PrinterCommand.id == command_id, PrinterCommand.printer_id == printer.id))
    if command is None:
        raise HTTPException(404, "Command not found")
    command.status, command.error_message = request.status, request.error or None
    db.commit()
    return {"status": command.status}


@router.get("/agent/jobs/{job_id}/gcode")
def agent_gcode(job_id: str, command_id: str, authorization: str | None = Header(None), db: Session = Depends(get_db)):
    printer, _connection = agent(db, authorization)
    command = db.scalar(select(PrinterCommand).where(PrinterCommand.id == command_id, PrinterCommand.printer_id == printer.id, PrinterCommand.action == "print", PrinterCommand.status == "delivered"))
    if command is None or command.payload.get("job_id") != job_id:
        raise HTTPException(404, "Assigned job not found")
    _job, task = owned_job(db, job_id, printer.owner_id)
    return Response(get_bytes(task.gcode_key), media_type="text/plain", headers={"X-Content-SHA256": task.gcode_sha256})


class CommandCreate(BaseModel):
    action: Literal["print", "pause", "resume", "stop", "home", "jog", "extrude"]
    job_id: str | None = None
    axis: Literal["X", "Y", "Z"] = "X"
    distance: float = Field(default=1, ge=-50, le=50)


@router.post("/printers/{printer_id}/commands", status_code=202)
def command(printer_id: str, request: CommandCreate, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    printer, connection = owned_printer(db, printer_id, principal.subject)
    if not connection.token_hash or not printer.last_seen or (now() - printer.last_seen).total_seconds() >= 45:
        raise HTTPException(409, "Printer agent is offline")
    payload = request.model_dump(exclude={"action"})
    if request.action == "print":
        if printer.state != "ready":
            raise HTTPException(409, "Printer is not ready")
        job, task = owned_job(db, request.job_id or "", principal.subject)
        if task.status != "completed" or not task.gcode_key:
            raise HTTPException(409, "Slice the model before printing")
        if connection.profile_name != task.printer_profile:
            raise HTTPException(409, "Printer profile must match the profile used to slice this G-code")
        pending = db.scalar(select(PrinterCommand).where(PrinterCommand.printer_id == printer.id, PrinterCommand.action == "print", PrinterCommand.status.in_(["queued", "delivered"])))
        if pending:
            raise HTTPException(409, "A print is already assigned")
        payload.update({"sha256": task.gcode_sha256, "filename": f"printhub-{job.id}.gcode"})
    elif request.action in {"home", "jog", "extrude"} and printer.state != "ready":
        raise HTTPException(409, "Motion controls require an idle printer")
    row = PrinterCommand(printer_id=printer.id, action=request.action, payload=payload, status="queued", created_at=now())
    db.add(row)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.get("/printers/{printer_id}/commands")
def commands(printer_id: str, principal: Principal = Depends(get_current_principal), db: Session = Depends(get_db)):
    owned_printer(db, printer_id, principal.subject)
    return [{"id": row.id, "action": row.action, "status": row.status, "error": row.error_message, "created_at": row.created_at} for row in db.scalars(select(PrinterCommand).where(PrinterCommand.printer_id == printer_id).order_by(PrinterCommand.created_at.desc()).limit(30))]
