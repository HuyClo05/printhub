"""Authenticated end-to-end test for a running self-hosted PrintHub stack.

Exercises the real services behind Caddy: Keycloak login (authorization code
+ PKCE through the hosted login form), a signed upload to SeaweedFS, the
PostgreSQL queue claim, a native OrcaSlicer slice, G-code storage and
download, slice cancellation, and print-command delivery to the real printer
agent running in simulator mode. No physical printer is contacted.

Two throwaway Keycloak users are created through the admin API and deleted
afterwards. Their PrintHub rows (jobs, files, a simulator printer) remain in
the database so a failed run can be inspected.

Start the stack first (fish scripts/start-local.fish --detach), then run from
the project root:

    .ph_venv/bin/python scripts/e2e-self-hosted.py
"""

from __future__ import annotations

import base64
import hashlib
import html
import math
import os
import re
import secrets
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.getenv("PRINTHUB_URL", "http://localhost:8080").rstrip("/")
REALM = os.getenv("KEYCLOAK_REALM", "printhub")
CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "printhub-frontend")
REDIRECT_URI = f"{BASE_URL}/"
SLICE_TIMEOUT = int(os.getenv("E2E_SLICE_TIMEOUT", "300"))

# OrcaSlicer system presets this stack has already sliced with successfully.
PRINTER_PARENT = os.getenv("E2E_PRINTER_PARENT", "Voron Trident 250 0.4 nozzle")
PROCESS_PARENT = os.getenv("E2E_PROCESS_PARENT", "0.20mm Standard @Voron")
FILAMENT_PARENT = os.getenv("E2E_FILAMENT_PARENT", "Generic ABS @System")

checks = 0


class E2EFailure(Exception):
    pass


def passed(message: str) -> None:
    global checks
    checks += 1
    print(f"PASS: {message}", flush=True)


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise E2EFailure(message)


def expect_status(response: httpx.Response, status: int, action: str) -> httpx.Response:
    expect(response.status_code == status, f"{action}: expected HTTP {status}, got {response.status_code}: {response.text[:500]}")
    return response


def read_env_file() -> dict[str, str]:
    values = {}
    path = PROJECT_ROOT / ".ph_env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


# ---------------------------------------------------------------- models


def binary_stl(triangles: list[tuple[tuple[float, float, float], ...]]) -> bytes:
    body = bytearray(b"PrintHub e2e".ljust(80, b" "))
    body += struct.pack("<I", len(triangles))
    for a, b, c in triangles:
        body += struct.pack("<12fH", 0, 0, 0, *a, *b, *c, 0)
    return bytes(body)


def cube(size: float = 20) -> bytes:
    p = [(x * size, y * size, z * size) for x in (0, 1) for y in (0, 1) for z in (0, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    triangles = []
    for a, b, c, d in faces:
        triangles += [(p[a], p[b], p[c]), (p[a], p[c], p[d])]
    return binary_stl(triangles)


def sphere(radius: float = 45, segments: int = 360, rings: int = 180) -> bytes:
    """A dense sphere that keeps OrcaSlicer busy long enough to cancel."""

    def point(ring: int, segment: int) -> tuple[float, float, float]:
        theta, phi = math.pi * ring / rings, 2 * math.pi * segment / segments
        return (
            radius * math.sin(theta) * math.cos(phi),
            radius * math.sin(theta) * math.sin(phi),
            radius + radius * math.cos(theta),
        )

    triangles = []
    for ring in range(rings):
        for segment in range(segments):
            a, b = point(ring, segment), point(ring, segment + 1)
            c, d = point(ring + 1, segment + 1), point(ring + 1, segment)
            if ring > 0:
                triangles.append((a, d, b))
            if ring < rings - 1:
                triangles.append((b, d, c))
    return binary_stl(triangles)


# ---------------------------------------------------------------- Keycloak


class KeycloakAdmin:
    def __init__(self, username: str, password: str):
        self.credentials = {"grant_type": "password", "client_id": "admin-cli", "username": username, "password": password}
        self.client = httpx.Client(base_url=BASE_URL, timeout=30)
        self.login()

    def login(self) -> None:
        # Master-realm admin tokens expire after about a minute; a full run is longer.
        token = self.client.post("/realms/master/protocol/openid-connect/token", data=self.credentials)
        expect_status(token, 200, "Keycloak admin login")
        self.client.headers["Authorization"] = f"Bearer {token.json()['access_token']}"

    def create_user(self, username: str, password: str) -> str:
        self.login()
        response = self.client.post(
            f"/admin/realms/{REALM}/users",
            json={
                "username": username,
                "email": f"{username}@example.test",
                "emailVerified": True,
                "firstName": "PrintHub",
                "lastName": "E2E",
                "enabled": True,
                "credentials": [{"type": "password", "value": password, "temporary": False}],
            },
        )
        expect_status(response, 201, f"create Keycloak user {username}")
        return response.headers["Location"].rsplit("/", 1)[-1]

    def delete_user(self, user_id: str) -> None:
        self.login()
        response = self.client.delete(f"/admin/realms/{REALM}/users/{user_id}")
        if response.status_code not in (204, 404):
            print(f"WARN: could not delete Keycloak test user {user_id}: HTTP {response.status_code}", file=sys.stderr)


def browser_login(username: str, password: str) -> str:
    """Log in through Keycloak's hosted form exactly as the frontend does."""

    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    realm_url = f"{BASE_URL}/realms/{REALM}/protocol/openid-connect"
    with httpx.Client(timeout=30) as browser:
        page = browser.get(
            f"{realm_url}/auth?"
            + urlencode(
                {
                    "client_id": CLIENT_ID,
                    "redirect_uri": REDIRECT_URI,
                    "response_type": "code",
                    "scope": "openid email profile",
                    "state": state,
                    "code_challenge": challenge,
                    "code_challenge_method": "S256",
                }
            )
        )
        expect_status(page, 200, "open Keycloak login page")
        action = re.search(r'<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"', page.text)
        expect(action is not None, "Keycloak login form was not found")
        # Keycloak marks its session cookies Secure. Browsers still send them to
        # http://localhost (a secure context); httpx does not, so forward them.
        cookies = "; ".join(f"{cookie.name}={cookie.value}" for cookie in browser.cookies.jar)
        submitted = browser.post(
            html.unescape(action.group(1)),
            data={"username": username, "password": password, "credentialId": ""},
            headers={"Cookie": cookies},
        )
        expect(submitted.status_code == 302, f"Keycloak rejected the login (HTTP {submitted.status_code}); a required action may be pending")
        redirect = urlparse(submitted.headers["Location"])
        query = parse_qs(redirect.query)
        expect(query.get("state") == [state], "Keycloak returned a different OAuth state")
        expect("code" in query, f"Keycloak redirect has no authorization code: {submitted.headers['Location']}")
        token = browser.post(
            f"{realm_url}/token",
            data={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "code": query["code"][0],
                "redirect_uri": REDIRECT_URI,
                "code_verifier": verifier,
            },
        )
        expect_status(token, 200, "exchange authorization code")
        return token.json()["access_token"]


# ---------------------------------------------------------------- API helpers


def api(token: str | None = None) -> httpx.Client:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.Client(base_url=f"{BASE_URL}/api/v1", headers=headers, timeout=60)


def upload(client: httpx.Client, name: str, content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()
    target = expect_status(
        client.post("/files/upload-url", json={"file_name": name, "file_size": len(content), "content_type": "model/stl", "sha256": digest}),
        201,
        f"request signed upload for {name}",
    ).json()
    expect(urlparse(target["upload_url"]).path.startswith("/printhub-artifacts/"), "upload URL does not target the SeaweedFS bucket")
    with httpx.Client(timeout=120) as storage:
        put = storage.put(target["upload_url"], content=content, headers={"Content-Type": "model/stl"})
    expect(put.status_code in (200, 201), f"SeaweedFS rejected the signed PUT: HTTP {put.status_code} {put.text[:300]}")
    complete = expect_status(client.post(f"/files/{target['file_id']}/complete"), 200, "complete upload").json()
    expect(complete["upload_status"] == "ready" and complete["sha256"] == digest, "upload was not verified as ready")
    return target["file_id"]


def create_profiles(client: httpx.Client, suffix: str) -> dict[str, str]:
    names = {"printers": f"E2E Trident {suffix}", "presets": f"E2E Standard @Voron {suffix}", "filaments": f"E2E ABS {suffix}"}
    parents = {"printers": PRINTER_PARENT, "presets": PROCESS_PARENT, "filaments": FILAMENT_PARENT}
    # Orca's CLI applies relative extrusion by default; it refuses to slice
    # unless each layer resets the extruder position.
    extra = {"printers": {"layer_change_gcode": "G92 E0"}}
    for category, name in names.items():
        settings = {"name": name, "inherits": parents[category], "from": "User", **extra.get(category, {})}
        expect_status(
            client.post("/profiles", json={"category": category, "name": name, "settings": settings}),
            201,
            f"create {category} profile",
        )
    return names


def start_slice(client: httpx.Client, file_id: str, profiles: dict[str, str]) -> str:
    response = client.post(
        "/slice-jobs",
        headers={"Idempotency-Key": secrets.token_hex(16)},
        json={"file_id": file_id, "printer_profile": profiles["printers"], "process_profile": profiles["presets"], "filament_profile": profiles["filaments"]},
    )
    return expect_status(response, 202, "queue slice job").json()["id"]


def wait_for(client: httpx.Client, job_id: str, statuses: set[str], timeout: float, interval: float = 1) -> dict:
    deadline = time.monotonic() + timeout
    seen = []
    while time.monotonic() < deadline:
        job = expect_status(client.get(f"/slice-jobs/{job_id}"), 200, "poll slice job").json()
        if not seen or seen[-1] != job["status"]:
            seen.append(job["status"])
        if job["status"] in statuses:
            return job
        if job["status"] == "dead-lettered":
            break
        time.sleep(interval)
    raise E2EFailure(f"job {job_id} went through {' -> '.join(seen)} without reaching {sorted(statuses)}; last error: {job.get('error_message')}")


# ---------------------------------------------------------------- scenario


def run(admin: KeycloakAdmin, created: list[str], agent_dir: Path) -> None:
    suffix = secrets.token_hex(4)
    password = secrets.token_urlsafe(18)
    alice, bob = f"e2e-alice-{suffix}", f"e2e-bob-{suffix}"
    for username in (alice, bob):
        created.append(admin.create_user(username, password))

    expect_status(api().get("/me"), 401, "anonymous /me")
    alice_token = browser_login(alice, password)
    bob_token = browser_login(bob, password)
    passed("real Keycloak login (authorization code + PKCE) for two users")

    with api(alice_token) as client, api(bob_token) as other:
        me = expect_status(client.get("/me"), 200, "authenticated /me").json()
        expect(me["email"] == f"{alice}@example.test", f"/me returned {me}")
        passed("API validated the Keycloak access token")

        profiles = create_profiles(client, suffix)
        model = cube()
        file_id = upload(client, f"e2e-cube-{suffix}.stl", model)
        stored = expect_status(client.get(f"/files/{file_id}/content"), 200, "read model back")
        expect(hashlib.sha256(stored.content).hexdigest() == hashlib.sha256(model).hexdigest(), "stored model differs from the upload")
        passed("signed upload to SeaweedFS verified by checksum")

        job_id = start_slice(client, file_id, profiles)
        job = wait_for(client, job_id, {"completed"}, SLICE_TIMEOUT)
        expect(job["attempt_count"] >= 1, "the worker never claimed the job")
        passed(f"PostgreSQL queue claim and native OrcaSlicer slice (attempt {job['attempt_count']}/{job['max_attempts']})")

        gcode = expect_status(client.get(f"/slice-jobs/{job_id}/gcode"), 200, "download G-code").content
        expect(hashlib.sha256(gcode).hexdigest() == job["gcode_sha256"], "downloaded G-code checksum does not match the stored record")
        expect(b"G1 " in gcode and len(gcode) > 10_000, "G-code does not look like a real toolpath")
        expect(re.search(rb"OrcaSlicer", gcode[:4000]) is not None, "G-code header was not produced by OrcaSlicer")
        listed = expect_status(client.get("/slice-jobs"), 200, "job history").json()
        expect(any(row["id"] == job_id for row in listed), "completed job is missing from the history the preview loads from")
        passed(f"G-code stored and downloadable for preview ({len(gcode):,} bytes, {job['print_time_seconds']}s estimate)")

        expect_status(other.get(f"/slice-jobs/{job_id}"), 404, "other user reads job")
        expect_status(other.get(f"/slice-jobs/{job_id}/gcode"), 404, "other user downloads G-code")
        expect_status(other.get(f"/files/{file_id}/content"), 404, "other user reads model")
        passed("another user cannot see the job, G-code, or model")

        big_id = upload(client, f"e2e-sphere-{suffix}.stl", sphere())
        cancel_id = start_slice(client, big_id, profiles)
        wait_for(client, cancel_id, {"slicing"}, 120, interval=0.25)
        cancelled = client.post(f"/slice-jobs/{cancel_id}/cancel")
        expect(cancelled.status_code != 409, "the cancellation model finished before it could be cancelled; use a denser model")
        expect_status(cancelled, 200, "cancel slice")
        time.sleep(10)  # worker lease watcher polls every 2s and kills the Orca process
        final = expect_status(client.get(f"/slice-jobs/{cancel_id}"), 200, "poll cancelled job").json()
        expect(final["status"] == "cancelled" and not final["gcode_sha256"], f"cancelled job changed to {final['status']}")
        expect_status(client.get(f"/slice-jobs/{cancel_id}/gcode"), 409, "G-code of a cancelled slice")
        # The single worker must be free again, so a fresh slice still completes.
        follow_up = start_slice(client, file_id, profiles)
        wait_for(client, follow_up, {"completed"}, SLICE_TIMEOUT)
        passed("slice cancelled mid-run, produced no G-code, and the worker recovered")

        printer = expect_status(
            client.post("/printers", json={"name": f"E2E simulator {suffix}", "host_type": "simulator", "profile_name": profiles["printers"]}),
            201,
            "register simulator printer",
        ).json()
        code = expect_status(client.post(f"/printers/{printer['id']}/pair"), 200, "create pairing code").json()["code"]
        log_path = agent_dir / "agent.log"
        with open(log_path, "w") as log:
            agent = subprocess.Popen(
                [sys.executable, "-m", "app.printer_agent", "--server", BASE_URL, "--pair", code, "--host", "http://127.0.0.1:9", "--config", str(agent_dir / "agent.json")],
                cwd=PROJECT_ROOT / "Backend",
                stdout=log,
                stderr=subprocess.STDOUT,
            )
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                state = next(p for p in expect_status(client.get("/printers"), 200, "list printers").json() if p["id"] == printer["id"])
                if state["state"] == "ready":
                    break
                time.sleep(1)
            expect(state["state"] == "ready", f"agent never reported ready; log:\n{log_path.read_text()[-2000:]}")
            expect_status(other.post(f"/printers/{printer['id']}/commands", json={"action": "print", "job_id": job_id}), 404, "other user commands printer")
            command = expect_status(client.post(f"/printers/{printer['id']}/commands", json={"action": "print", "job_id": job_id}), 202, "queue print").json()
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                history = expect_status(client.get(f"/printers/{printer['id']}/commands"), 200, "command history").json()
                status = next(row for row in history if row["id"] == command["id"])
                if status["status"] in {"completed", "failed"}:
                    break
                time.sleep(1)
            expect(status["status"] == "completed", f"print command ended as {status['status']}: {status['error']}")
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                state = next(p for p in client.get("/printers").json() if p["id"] == printer["id"])
                if state["state"] == "printing":
                    break
                time.sleep(1)
            expect(state["state"] == "printing", f"simulator did not start printing; state is {state['state']}")
            expect(state["telemetry"].get("filename") == f"printhub-{job_id}.gcode", "simulator is printing a different file")
            expect_status(client.post(f"/printers/{printer['id']}/commands", json={"action": "stop"}), 202, "queue stop")
            passed("print command delivered once, G-code checksum verified by the agent, simulator printing")
        finally:
            agent.terminate()
            agent.wait(10)


def main() -> int:
    env = read_env_file()
    admin = KeycloakAdmin(os.getenv("KEYCLOAK_ADMIN", env.get("KEYCLOAK_ADMIN", "admin")), os.getenv("KEYCLOAK_ADMIN_PASSWORD", env.get("KEYCLOAK_ADMIN_PASSWORD", "change-me")))
    created: list[str] = []
    with tempfile.TemporaryDirectory(prefix="printhub-e2e-") as agent_dir:
        try:
            run(admin, created, Path(agent_dir))
        except E2EFailure as failure:
            print(f"FAIL: {failure}", file=sys.stderr)
            return 1
        finally:
            for user_id in created:
                admin.delete_user(user_id)
    print(f"\nAuthenticated end-to-end test complete: {checks} checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
