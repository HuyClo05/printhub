"""Isolated API regressions: no PostgreSQL, S3, identity provider or printer needed.

Run from Backend: ../.ph_venv/bin/python -m unittest discover -s tests -v
SQLite checks application behavior, not PostgreSQL row-lock concurrency.
"""
import hashlib
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import Principal, get_current_principal
from app.calibration import apply_calibration, validate_calibration
from app.db import Base, get_db
from app.main import app
from app.models import PrintJob, PrintTask, StlFile, SlicerProfileVersion, User
from app.models.workspace import PrinterConnection
from app.printer_agent import PrinterHost
from app.profile_versions import normalize_profile_settings
from app import worker


@compiles(JSONB, "sqlite")
def sqlite_json(_type, _compiler, **_kw):
    return "JSON"


def utc_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.owner = "alice"
        def session():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_principal] = lambda: Principal(self.owner, f"{self.owner}@example.test", "https://issuer.test")
        # SQLite returns naive timestamps; PostgreSQL returns timezone-aware ones.
        self.clock = patch("app.workspace_routes.now", utc_naive)
        self.clock.start()
        self.client = TestClient(app)
        with Session(self.engine) as db:
            for owner in ("alice", "bob"):
                db.add(User(id=owner, email=f"{owner}@example.test", created_at=utc_naive()))
            db.commit()

    def tearDown(self):
        self.client.close()
        self.clock.stop()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def job(self, owner="alice", status="slicing"):
        with Session(self.engine) as db:
            file = StlFile(file_name="cube.3mf", file_size=32, sha256="a" * 64, stl_url="private/model", uploaded_by=owner, uploaded_at=utc_naive())
            db.add(file); db.flush()
            job = PrintJob(created_by=owner, job_name="cube", status=status, created_at=utc_naive())
            db.add(job); db.flush()
            task = PrintTask(job_id=job.id, file_id=file.id, status=status, created_at=utc_naive(), available_at=utc_naive(), lease_owner="worker", printer_profile="Voron", gcode_key="private/code" if status == "completed" else None, gcode_sha256="b" * 64)
            db.add(task); db.commit()
            return job.id, task.id, file.id

    def paired_printer(self):
        response = self.client.post("/api/v1/printers", json={"name": "Test printer", "host_type": "simulator", "profile_name": "Voron"})
        self.assertEqual(response.status_code, 201, response.text)
        printer_id = response.json()["id"]
        code = self.client.post(f"/api/v1/printers/{printer_id}/pair").json()["code"]
        redeemed = self.client.post("/api/v1/agent/pair", json={"code": code})
        self.assertEqual(redeemed.status_code, 200, redeemed.text)
        headers = {"Authorization": f"Bearer {redeemed.json()['token']}"}
        return printer_id, code, headers

    def test_job_history_and_cancellation_are_owner_scoped(self):
        mine, task_id, _ = self.job()
        other, _, file_id = self.job("bob")
        self.assertEqual([j["id"] for j in self.client.get("/api/v1/slice-jobs").json()], [mine])
        for suffix in ("cancel", "retry"):
            self.assertEqual(self.client.post(f"/api/v1/slice-jobs/{other}/{suffix}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/files/{file_id}/content").status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/slice-jobs/{mine}/cancel").json()["status"], "cancelled")
        with Session(self.engine) as db:
            self.assertIsNone(db.get(PrintTask, task_id).lease_owner)
        self.assertEqual(self.client.post(f"/api/v1/slice-jobs/{mine}/retry").json()["status"], "queued")

    def test_completed_jobs_cannot_be_cancelled_or_retried(self):
        job, _, _ = self.job(status="completed")
        for suffix in ("cancel", "retry"):
            self.assertEqual(self.client.post(f"/api/v1/slice-jobs/{job}/{suffix}").status_code, 409)

    def test_pairing_is_single_use_hashed_and_revocable(self):
        printer, code, headers = self.paired_printer()
        self.assertEqual(self.client.post("/api/v1/agent/pair", json={"code": code}).status_code, 401)
        with Session(self.engine) as db:
            connection = db.get(PrinterConnection, printer)
            self.assertIsNone(connection.pairing_hash)
            self.assertNotEqual(connection.token_hash, headers["Authorization"][7:])
        self.assertEqual(self.client.post("/api/v1/agent/heartbeat", headers=headers, json={"state": "ready"}).status_code, 200)
        self.client.post(f"/api/v1/printers/{printer}/pair")
        self.assertEqual(self.client.post("/api/v1/agent/heartbeat", headers=headers, json={"state": "ready"}).status_code, 401)

    def test_printer_and_commands_are_owner_scoped(self):
        printer, _, _ = self.paired_printer()
        self.owner = "bob"
        self.assertEqual(self.client.get("/api/v1/printers").json(), [])
        self.assertEqual(self.client.post(f"/api/v1/printers/{printer}/pair").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/printers/{printer}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/printers/{printer}/commands").status_code, 404)

    def test_command_delivery_once_and_explicit_acknowledgement(self):
        printer, _, headers = self.paired_printer()
        beat = lambda: self.client.post("/api/v1/agent/heartbeat", headers=headers, json={"state": "ready", "telemetry": {"nozzle_temperature": 25}})
        beat()
        job, _, _ = self.job(status="completed")
        queued = self.client.post(f"/api/v1/printers/{printer}/commands", json={"action": "print", "job_id": job})
        self.assertEqual(queued.status_code, 202, queued.text)
        self.assertEqual(self.client.post(f"/api/v1/printers/{printer}/commands", json={"action": "print", "job_id": job}).status_code, 409)
        with patch("app.workspace_routes.presigned_get_url", return_value="https://storage.test/signed"):
            commands = beat().json()["commands"]
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0]["payload"]["sha256"], "b" * 64)
        self.assertEqual(beat().json()["commands"], [])
        ack = self.client.post(f"/api/v1/agent/commands/{commands[0]['id']}", headers=headers, json={"status": "completed"})
        self.assertEqual(ack.status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/printers/{printer}/commands").json()[0]["status"], "completed")

    def test_motion_rejected_when_offline_busy_or_out_of_range(self):
        printer, _, headers = self.paired_printer()
        endpoint = f"/api/v1/printers/{printer}/commands"
        self.assertEqual(self.client.post(endpoint, json={"action": "home"}).status_code, 409)
        self.client.post("/api/v1/agent/heartbeat", headers=headers, json={"state": "printing"})
        self.assertEqual(self.client.post(endpoint, json={"action": "jog", "distance": 1}).status_code, 409)
        self.assertEqual(self.client.post(endpoint, json={"action": "jog", "distance": 51}).status_code, 422)

    def test_agent_refuses_corrupted_printer_host_file(self):
        calls = []
        def host_response(request):
            calls.append(request.url.path)
            if request.url.path == "/printer/objects/query":
                return httpx.Response(200, json={"result": {"status": {"print_stats": {"state": "standby"}}}})
            if request.method == "POST":
                return httpx.Response(200, json={})
            return httpx.Response(200, content=b"corrupted")
        host = PrinterHost("moonraker", "http://printer.test")
        host.client.close()
        host.client = httpx.Client(base_url="http://printer.test", transport=httpx.MockTransport(host_response))
        command = {"action": "print", "payload": {"filename": "test.gcode", "sha256": hashlib.sha256(b"correct").hexdigest()}}
        with self.assertRaisesRegex(RuntimeError, "checksum"):
            host.execute(command, b"correct")
        self.assertNotIn("/printer/print/start", calls)
        host.client.close()

    def test_orca_profile_origin_normalization(self):
        self.assertEqual(normalize_profile_settings("printers", "Test", {"from": "System"})["from"], "system")
        self.assertEqual(normalize_profile_settings("printers", "Test", {"from": "user"})["from"], "User")

    def test_slice_pins_owned_profile_versions(self):
        _, _, file_id = self.job(status="completed")
        with Session(self.engine) as db:
            for owner in ("alice", "bob"):
                for category, name in (("printers", "Voron"), ("presets", "Quality"), ("filaments", "PLA")):
                    db.add(SlicerProfileVersion(id=f"{owner}-{category}", owner_id=owner, category=category, name=name, version=1, settings={"name": name}, sha256="a" * 64, object_key=f"private/{owner}/{category}", created_at=utc_naive()))
            db.add(SlicerProfileVersion(id="alice-new-process", owner_id="alice", category="presets", name="Quality", version=2, settings={"name": "Quality", "layer_height": "0.3"}, sha256="c" * 64, object_key="private/new-process", created_at=utc_naive()))
            db.commit()
        body = {"file_id": file_id, "printer_profile": "Voron", "process_profile": "Quality", "filament_profile": "PLA", "process_profile_version_id": "alice-presets"}
        response = self.client.post("/api/v1/slice-jobs", json=body)
        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["process_profile_version_id"], "alice-presets")
        body["process_profile_version_id"] = "bob-presets"
        self.assertEqual(self.client.post("/api/v1/slice-jobs", json=body).status_code, 400)
        self.assertEqual(self.client.get("/api/v1/profiles/bob-presets").status_code, 404)

    def test_profile_history_notes_filters_and_restore(self):
        def save(settings, note=None):
            body = {"category": "presets", "name": "Quality", "settings": {"name": "Quality", **settings}, "note": note}
            response = self.client.post("/api/v1/profiles", json=body)
            self.assertEqual(response.status_code, 201, response.text)
            return response.json()
        with patch("app.profile_versions.put_bytes"), patch("app.profile_versions.install_profile_file"):
            first = save({"wall_loops": "2"}, "  baseline  ")
            save({"wall_loops": "4"})
            self.client.post("/api/v1/profiles", json={"category": "filaments", "name": "PLA", "settings": {"name": "PLA"}})
            restored = self.client.post(f"/api/v1/profiles/{first['id']}/restore", json={})
            self.assertEqual(restored.status_code, 201, restored.text)
            restored = restored.json()
            self.owner = "bob"
            self.assertEqual(self.client.post(f"/api/v1/profiles/{first['id']}/restore", json={}).status_code, 404)
            self.owner = "alice"
        self.assertEqual(first["note"], "baseline")
        self.assertEqual((restored["version"], restored["note"], restored["restored_from_id"]), (3, "Restored from v1", first["id"]))
        self.assertEqual(self.client.get(f"/api/v1/profiles/{restored['id']}").json()["settings"]["wall_loops"], "2")
        history = self.client.get("/api/v1/profiles", params={"category": "presets", "name": "Quality"}).json()
        self.assertEqual([row["version"] for row in history], [3, 2, 1])

    def test_resolved_profile_merges_user_and_system_inheritance(self):
        with Session(self.engine) as db:
            db.add(SlicerProfileVersion(id="base", owner_id="alice", category="presets", name="Base", version=1, settings={"name": "Base", "inherits": "System", "wall_loops": "3", "top_shell_layers": "4"}, sha256="a" * 64, object_key="private/base", created_at=utc_naive()))
            db.add(SlicerProfileVersion(id="child", owner_id="alice", category="presets", name="Child", version=1, settings={"name": "Child", "inherits": "Base", "wall_loops": "4"}, sha256="b" * 64, object_key="private/child", created_at=utc_naive()))
            db.commit()
        system = {"name": "System", "type": "process", "wall_loops": "2", "top_shell_layers": "3", "line_width": "0.42"}
        with patch("app.slicing_routes.SlicerClient.resolved_profile", return_value=system) as lookup:
            response = self.client.get("/api/v1/slicer/profiles/presets/Child/resolved")
        self.assertEqual(response.status_code, 200, response.text)
        settings = response.json()["settings"]
        self.assertEqual((settings["wall_loops"], settings["top_shell_layers"], settings["line_width"], settings["name"]), ("4", "4", "0.42", "Child"))
        lookup.assert_called_once_with("presets", "System")
        self.owner = "bob"
        with patch("app.slicing_routes.SlicerClient.resolved_profile", return_value=None):
            self.assertEqual(self.client.get("/api/v1/slicer/profiles/presets/Child/resolved").status_code, 404)

    def test_process_overrides_are_persisted_in_the_immutable_slice_profile(self):
        _, _, file_id = self.job(status="completed")
        with Session(self.engine) as db:
            for category, name in (("printers", "Voron"), ("presets", "Quality"), ("filaments", "PLA")):
                db.add(SlicerProfileVersion(id=f"alice-{category}", owner_id="alice", category=category, name=name, version=1, settings={"name": name}, sha256="a" * 64, object_key=f"private/alice/{category}", created_at=utc_naive()))
            db.commit()
        body = {
            "file_id": file_id,
            "printer_profile": "Voron",
            "process_profile": "Quality",
            "filament_profile": "PLA",
            "process_overrides": {
                "flush_volumes_matrix": ["0", "140", "120", "0"],
                "flush_multiplier": "1.1",
            },
        }
        with patch("app.profile_versions.put_bytes"), patch("app.profile_versions.install_profile_file"):
            response = self.client.post("/api/v1/slice-jobs", json=body)
        self.assertEqual(response.status_code, 202, response.text)
        with Session(self.engine) as db:
            version = db.get(SlicerProfileVersion, response.json()["process_profile_version_id"])
            self.assertEqual(version.settings["flush_volumes_matrix"], ["0", "140", "120", "0"])
            self.assertEqual(version.settings["flush_multiplier"], "1.1")

    def test_worker_retries_with_backoff_then_dead_letters(self):
        job_id, task_id, _ = self.job(status="queued")
        factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        now = utc_naive()
        with patch.object(worker, "SessionLocal", factory), patch.object(worker, "WORKER_ID", "test-worker"), patch.object(worker, "utcnow", return_value=now), patch.object(worker, "worker_retry_base_seconds", return_value=2):
            self.assertEqual(worker.claim_task(), task_id)
            worker.fail_task(task_id, RuntimeError("temporary slicer failure"))
            with Session(self.engine) as db:
                task = db.get(PrintTask, task_id)
                self.assertEqual(task.status, "retrying")
                self.assertEqual(task.attempt_count, 1)
                self.assertEqual(task.available_at, now + timedelta(seconds=2))
                self.assertEqual(db.get(PrintJob, job_id).status, "retrying")
                task.available_at = now - timedelta(seconds=1)
                task.attempt_count = task.max_attempts - 1
                db.commit()
            self.assertEqual(worker.claim_task(), task_id)
            worker.fail_task(task_id, RuntimeError("permanent slicer failure"))
            with Session(self.engine) as db:
                task = db.get(PrintTask, task_id)
                self.assertEqual(task.status, "dead-lettered")
                self.assertEqual(task.attempt_count, task.max_attempts)
                self.assertEqual(db.get(PrintJob, job_id).status, "dead-lettered")

    def test_expired_final_worker_lease_is_dead_lettered(self):
        job_id, task_id, _ = self.job(status="slicing")
        now = utc_naive()
        with Session(self.engine) as db:
            task = db.get(PrintTask, task_id)
            task.attempt_count = task.max_attempts
            task.lease_expires_at = now - timedelta(seconds=1)
            db.commit()
        factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        with patch.object(worker, "SessionLocal", factory), patch.object(worker, "utcnow", return_value=now):
            self.assertEqual(worker.dead_letter_expired_final_attempts(), 1)
        with Session(self.engine) as db:
            self.assertEqual(db.get(PrintTask, task_id).status, "dead-lettered")
            self.assertEqual(db.get(PrintJob, job_id).status, "dead-lettered")

    def test_calibration_validation_and_gcode_application(self):
        options = {"kind": "Temperature", "start": 200, "end": 210, "step": 5, "bandHeight": 5}
        validate_calibration(options, {"gcode_flavor": "marlin"})
        source = b";Z:0.2\nG1 X0 Y0 E0\n;Z:5.2\nG1 X10 Y0 E1\n"
        output = apply_calibration(source, options).decode()
        self.assertIn("M104 S200", output)
        self.assertIn("M104 S205", output)
        with self.assertRaisesRegex(ValueError, "Klipper"):
            validate_calibration({"kind": "Pressure Advance", "start": 0, "end": .1, "step": .01}, {"gcode_flavor": "marlin"})


if __name__ == "__main__":
    unittest.main()
