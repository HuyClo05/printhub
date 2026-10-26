"""Durable PostgreSQL-backed slicing worker for self-hosted PrintHub."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import socket
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from dataclasses import replace
from pathlib import Path

from sqlalchemy import and_, or_, select, update

from app.config import slicer_data_path, worker_lease_seconds, worker_poll_seconds, worker_retry_base_seconds
from app.db import SessionLocal
from app.models import PrintJob, PrintTask, SlicerProfileVersion, StlFile
from app.profile_versions import materialize_task_profiles, normalize_profile_settings
from app.calibration import apply_calibration
from app.slicer import SlicerClient
from app.storage import get_bytes, put_bytes


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("printhub.worker")
WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def claim_task() -> str | None:
    """Atomically claim one available task, including an expired lease."""

    now = utcnow()
    db = SessionLocal()
    try:
        with db.begin():
            task = db.scalar(
                select(PrintTask)
                .where(
                    PrintTask.attempt_count < PrintTask.max_attempts,
                    or_(
                        and_(
                            PrintTask.status.in_(("queued", "retrying")),
                            PrintTask.available_at <= now,
                        ),
                        and_(
                            PrintTask.status == "slicing",
                            PrintTask.lease_expires_at < now,
                        ),
                    ),
                )
                .order_by(PrintTask.available_at, PrintTask.created_at)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if task is None:
                return None
            task.attempt_count += 1
            task.status = "slicing"
            task.lease_owner = WORKER_ID
            task.lease_expires_at = now + timedelta(seconds=worker_lease_seconds())
            task.last_heartbeat_at = now
            task.started_at = task.started_at or now
            task.error_message = None
            job = db.get(PrintJob, task.job_id)
            if job is not None:
                job.status = "slicing"
                job.started_at = job.started_at or now
            task_id = task.id
        logger.info("Claimed task %s (attempt %s/%s)", task_id, task.attempt_count, task.max_attempts)
        return task_id
    finally:
        db.close()


def dead_letter_expired_final_attempts() -> int:
    """Route a fifth attempt to dead-letter if its worker died before reporting failure."""

    now = utcnow()
    db = SessionLocal()
    try:
        with db.begin():
            tasks = list(
                db.scalars(
                    select(PrintTask)
                    .where(
                        PrintTask.status == "slicing",
                        PrintTask.attempt_count >= PrintTask.max_attempts,
                        PrintTask.lease_expires_at < now,
                    )
                    .with_for_update(skip_locked=True)
                )
            )
            for task in tasks:
                task.status = "dead-lettered"
                task.dead_lettered_at = now
                task.error_message = "Worker lease expired during the final delivery attempt"
                task.lease_owner = None
                task.lease_expires_at = None
                job = db.get(PrintJob, task.job_id)
                if job is not None:
                    job.status = "dead-lettered"
                    job.completed_at = now
        for task in tasks:
            logger.error("Task %s dead-lettered after its final worker lease expired", task.id)
        return len(tasks)
    finally:
        db.close()


def renew_lease(task_id: str) -> bool:
    now = utcnow()
    db = SessionLocal()
    try:
        result = db.execute(
            update(PrintTask)
            .where(
                PrintTask.id == task_id,
                PrintTask.status == "slicing",
                PrintTask.lease_owner == WORKER_ID,
            )
            .values(
                lease_expires_at=now + timedelta(seconds=worker_lease_seconds()),
                last_heartbeat_at=now,
            )
        )
        db.commit()
        return result.rowcount == 1
    finally:
        db.close()


async def heartbeat(task_id: str) -> None:
    interval = max(worker_lease_seconds() / 3, 5)
    while True:
        await asyncio.sleep(interval)
        if not await asyncio.to_thread(renew_lease, task_id):
            logger.warning("Lease for task %s is no longer owned by this worker", task_id)
            return


async def watch_slice(task_id: str, request_id: str) -> None:
    while True:
        await asyncio.sleep(2)
        if not await asyncio.to_thread(renew_lease, task_id):
            await SlicerClient().cancel(request_id)
            return


def load_task_inputs(
    task_id: str,
) -> tuple[PrintJob, PrintTask, StlFile, tuple[str, str, str], tuple[bytes, bytes, bytes], bytes]:
    db = SessionLocal()
    try:
        task = db.get(PrintTask, task_id)
        if task is None or task.lease_owner != WORKER_ID or task.status != "slicing":
            raise RuntimeError("Task lease was lost before slicing began")
        job = db.get(PrintJob, task.job_id)
        model = db.get(StlFile, task.file_id)
        if job is None or model is None or model.upload_status != "ready" or not model.stl_url:
            raise RuntimeError("The queued model is unavailable")

        version_ids = (
            task.printer_profile_version_id,
            task.process_profile_version_id,
            task.filament_profile_version_id,
        )
        if any(version_id is None for version_id in version_ids):
            raise RuntimeError("The task does not reference immutable profile versions")
        printer = db.get(SlicerProfileVersion, version_ids[0])
        process = db.get(SlicerProfileVersion, version_ids[1])
        filament = db.get(SlicerProfileVersion, version_ids[2])
        if any(profile is None or profile.owner_id != job.created_by for profile in (printer, process, filament)):
            raise RuntimeError("A task profile version is missing or belongs to another user")

        model_content = get_bytes(model.stl_url)
        model_digest = hashlib.sha256(model_content).hexdigest()
        if model.sha256 and model.sha256 != model_digest:
            raise RuntimeError("Model checksum verification failed")
        aliases = materialize_task_profiles(printer, process, filament)
        profile_categories = ("printers", "presets", "filaments")
        profile_data = tuple(
            (Path(slicer_data_path()) / category / f"{alias}.json").read_bytes()
            for category, alias in zip(profile_categories, aliases, strict=True)
        )
        additional = []
        for version_id in (task.slice_options or {}).get("filament_versions", []):
            row = db.scalar(select(SlicerProfileVersion).where(SlicerProfileVersion.id == version_id, SlicerProfileVersion.owner_id == job.created_by, SlicerProfileVersion.category == "filaments"))
            if row is None:
                raise RuntimeError("An immutable filament version is unavailable")
            additional.append(normalize_profile_settings("filaments", row.name, row.settings))
        if additional:
            profile_data = (*profile_data[:2], json.dumps({"_printhub_filaments": [json.loads(profile_data[2]), *additional]}).encode())
        # Return detached objects only for immutable/scalar values used below.
        db.expunge(job)
        db.expunge(task)
        db.expunge(model)
        return job, task, model, aliases, profile_data, model_content
    finally:
        db.close()


async def process_task(task_id: str) -> None:
    lease_heartbeat = asyncio.create_task(heartbeat(task_id))
    slice_watcher = None
    try:
        job, task, model, aliases, profile_data, model_content = await asyncio.to_thread(
            load_task_inputs, task_id
        )
        printer_alias, process_alias, filament_alias = aliases
        request_id = f"{task_id}-{task.attempt_count}"
        slice_watcher = asyncio.create_task(watch_slice(task_id, request_id))
        printer_profile_data, process_profile_data, filament_profile_data = profile_data
        logger.info(
            "Materialized slicer profiles for task %s: printer=%s, process=%s, filament=%s",
            task_id,
            printer_alias,
            process_alias,
            filament_alias,
        )
        output = await SlicerClient().slice_model(
            filename=model.file_name,
            model=model_content,
            printer_profile=printer_alias,
            process_profile=process_alias,
            filament_profile=filament_alias,
            printer_profile_data=printer_profile_data,
            process_profile_data=process_profile_data,
            filament_profile_data=filament_profile_data,
            request_id=request_id,
            calibration_kind=((task.slice_options or {}).get("calibration") or {}).get("kind"),
            arrange=task.arrange,
            orient=task.orient,
        )
        calibration = (task.slice_options or {}).get("calibration")
        if calibration:
            output = replace(output, content=apply_calibration(output.content, calibration))
        gcode_digest = hashlib.sha256(output.content).hexdigest()
        gcode_key = f"users/{job.created_by}/gcode/{job.id}/{gcode_digest}.gcode"
        await asyncio.to_thread(put_bytes, gcode_key, output.content, "text/plain")
        await asyncio.to_thread(complete_task, task_id, gcode_key, gcode_digest, output)
        logger.info("Completed task %s; G-code SHA-256 %s", task_id, gcode_digest)
    except asyncio.CancelledError:
        logger.warning("Worker stopped while task %s was active; its lease will expire", task_id)
        raise
    except Exception as error:  # noqa: BLE001 - failures are persisted for retry/dead-letter handling
        logger.exception("Task %s failed", task_id)
        await asyncio.to_thread(fail_task, task_id, error)
    finally:
        if slice_watcher:
            slice_watcher.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await slice_watcher
        lease_heartbeat.cancel()
        with suppress(asyncio.CancelledError):
            await lease_heartbeat


def complete_task(task_id: str, gcode_key: str, gcode_digest: str, output) -> None:
    now = utcnow()
    db = SessionLocal()
    try:
        with db.begin():
            task = db.scalar(
                select(PrintTask)
                .where(
                    PrintTask.id == task_id,
                    PrintTask.status == "slicing",
                    PrintTask.lease_owner == WORKER_ID,
                )
                .with_for_update()
            )
            if task is None:
                raise RuntimeError("Task lease was lost before completion could be recorded")
            job = db.get(PrintJob, task.job_id)
            model = db.get(StlFile, task.file_id)
            task.status = "completed"
            task.gcode_key = gcode_key
            task.gcode_sha256 = gcode_digest
            task.print_time_seconds = output.print_time_seconds
            task.estimated_print_time = output.print_time_seconds
            task.filament_used_g = output.filament_used_g
            task.filament_used_mm = output.filament_used_mm
            task.error_message = None
            task.completed_at = now
            task.lease_owner = None
            task.lease_expires_at = None
            if model is not None:
                model.gcode_url = gcode_key
            if job is not None:
                job.status = "completed"
                job.completed_at = now
    finally:
        db.close()


def fail_task(task_id: str, error: Exception) -> None:
    now = utcnow()
    db = SessionLocal()
    try:
        with db.begin():
            task = db.scalar(select(PrintTask).where(PrintTask.id == task_id).with_for_update())
            if task is None or task.lease_owner != WORKER_ID:
                return
            job = db.get(PrintJob, task.job_id)
            task.error_message = str(error)[:4000]
            task.lease_owner = None
            task.lease_expires_at = None
            if task.attempt_count >= task.max_attempts:
                task.status = "dead-lettered"
                task.dead_lettered_at = now
                if job is not None:
                    job.status = "dead-lettered"
                    job.completed_at = now
                logger.error("Task %s moved to the dead-letter queue after %s attempts", task.id, task.attempt_count)
            else:
                delay = min(worker_retry_base_seconds() * (2 ** (task.attempt_count - 1)), 300)
                task.status = "retrying"
                task.available_at = now + timedelta(seconds=delay)
                if job is not None:
                    job.status = "retrying"
                logger.warning("Task %s will retry in %s seconds", task.id, delay)
    finally:
        db.close()


async def main() -> None:
    logger.info("Self-hosted slicing worker %s started", WORKER_ID)
    while True:
        await asyncio.to_thread(dead_letter_expired_final_attempts)
        task_id = await asyncio.to_thread(claim_task)
        if task_id is None:
            await asyncio.sleep(worker_poll_seconds())
            continue
        await process_task(task_id)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped")
