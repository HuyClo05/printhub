"""Outbound-only PrintHub agent. Run on the printer LAN, not the API host.

python -m app.printer_agent --server http://localhost:8080 --pair CODE --host http://printer:7125
Printer API keys are read only from PRINTHUB_HOST_API_KEY on this machine.
"""
import argparse
import base64
import hashlib
import json
import logging
import os
import time
from pathlib import Path

import httpx

log = logging.getLogger("printhub.agent")


class PrinterHost:
    def __init__(self, kind, host, api_key=""):
        self.kind = kind
        self.client = httpx.Client(base_url=host.rstrip("/"), headers={"X-Api-Key": api_key} if api_key else {}, timeout=60)
        self.simulated = {"state": "ready", "progress": 0, "nozzle_temperature": 22, "bed_temperature": 22}
        self.started = None

    def telemetry(self):
        if self.kind == "simulator":
            if self.simulated["state"] == "printing":
                self.simulated["progress"] = min(1, (time.monotonic() - self.started) / 120)
                if self.simulated["progress"] >= 1:
                    self.simulated["state"] = "ready"
            return dict(self.simulated)
        if self.kind == "moonraker":
            response = self.client.get("/printer/objects/query", params={"print_stats": "", "virtual_sdcard": "", "extruder": "", "heater_bed": ""})
            response.raise_for_status()
            data = response.json()["result"]["status"]
            stats, nozzle, bed = data.get("print_stats", {}), data.get("extruder", {}), data.get("heater_bed", {})
            state = {"standby": "ready", "complete": "ready", "cancelled": "ready", "error": "error", "printing": "printing", "paused": "paused"}.get(stats.get("state"), "ready")
            return {"state": state, "filename": stats.get("filename"), "message": stats.get("message"), "progress": data.get("virtual_sdcard", {}).get("progress", 0), "nozzle_temperature": nozzle.get("temperature"), "nozzle_target": nozzle.get("target"), "bed_temperature": bed.get("temperature"), "bed_target": bed.get("target")}
        status = self.client.get("/api/printer"); status.raise_for_status()
        job = self.client.get("/api/job"); job.raise_for_status()
        data, print_job = status.json(), job.json()
        flags = data.get("state", {}).get("flags", {})
        state = "printing" if flags.get("printing") else "paused" if flags.get("paused") else "ready" if flags.get("ready") else "offline"
        temperatures = data.get("temperature", {})
        return {"state": state, "filename": print_job.get("job", {}).get("file", {}).get("name"), "progress": (print_job.get("progress", {}).get("completion") or 0) / 100, "nozzle_temperature": temperatures.get("tool0", {}).get("actual"), "nozzle_target": temperatures.get("tool0", {}).get("target"), "bed_temperature": temperatures.get("bed", {}).get("actual"), "bed_target": temperatures.get("bed", {}).get("target")}

    def execute(self, command, gcode=None):
        action, payload = command["action"], command["payload"]
        if self.kind == "simulator":
            if action == "print":
                self.started = time.monotonic(); self.simulated.update(state="printing", progress=0, filename=payload["filename"], nozzle_temperature=205, bed_temperature=60)
            elif action == "pause":
                self.simulated["state"] = "paused"
            elif action == "resume":
                self.started = time.monotonic() - self.simulated["progress"] * 120; self.simulated["state"] = "printing"
            elif action == "stop":
                self.simulated["state"] = "ready"
            return
        # Host state is checked again here so a queued motion action cannot
        # move an axis after another client has started a print.
        state = self.telemetry()["state"]
        if action in {"print", "home", "jog", "extrude"} and state != "ready":
            raise RuntimeError("Printer must be idle before executing this command")
        if action == "print":
            if self.kind == "moonraker":
                response = self.client.post("/server/files/upload", data={"root": "gcodes", "print": "false"}, files={"file": (payload["filename"], gcode, "text/plain")})
                response.raise_for_status()
                # Verify the host-stored artifact before starting the print.
                stored = self.client.get(f"/server/files/gcodes/{payload['filename']}"); stored.raise_for_status()
                if hashlib.sha256(stored.content).hexdigest() != payload["sha256"]:
                    raise RuntimeError("Printer-host checksum verification failed")
                response = self.client.post("/printer/print/start", json={"filename": payload["filename"]})
            else:
                response = self.client.post("/api/files/local", data={"select": "false", "print": "false"}, files={"file": (payload["filename"], gcode, "text/plain")})
                response.raise_for_status()
                stored = self.client.get(f"/downloads/files/local/{payload['filename']}"); stored.raise_for_status()
                if hashlib.sha256(stored.content).hexdigest() != payload["sha256"]:
                    raise RuntimeError("Printer-host checksum verification failed")
                response = self.client.post(f"/api/files/local/{payload['filename']}", json={"command": "select", "print": True})
        elif action in {"pause", "resume", "stop"}:
            if self.kind == "moonraker":
                response = self.client.post(f"/printer/print/{'cancel' if action == 'stop' else action}")
            else:
                response = self.client.post("/api/job", json={"command": "cancel"} if action == "stop" else {"command": "pause", "action": action})
        else:
            axis, distance = payload.get("axis", "X"), float(payload.get("distance", 1))
            if axis not in {"X", "Y", "Z"} or abs(distance) > 50:
                raise RuntimeError("Invalid motion command")
            if action == "extrude":
                if (self.telemetry().get("nozzle_temperature") or 0) < 170:
                    raise RuntimeError("Heat the nozzle using your printer controls before extruding")
                script = f"M83\nG1 E{distance} F120\nM82"
            elif action == "jog":
                script = f"G91\nG1 {axis}{distance} F600\nG90"
            elif action == "home":
                script = "G28"
            else:
                raise RuntimeError("Unsupported command")
            if self.kind == "moonraker":
                response = self.client.post("/printer/gcode/script", json={"script": script})
            else:
                response = self.client.post("/api/printer/command", json={"commands": script.splitlines()})
        response.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", required=True)
    parser.add_argument("--pair")
    parser.add_argument("--host", default="http://127.0.0.1:7125")
    parser.add_argument("--config", default=".ph_agent.json")
    parser.add_argument("--camera", help="Local JPEG snapshot URL relayed to the dashboard")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    path = Path(args.config)
    server = args.server.rstrip("/")
    with httpx.Client(base_url=f"{server}/api/v1", timeout=60) as client:
        if args.pair:
            response = client.post("/agent/pair", json={"code": args.pair}); response.raise_for_status()
            config = {**response.json(), "server": server}
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w") as file:
                json.dump(config, file)
        else:
            config = json.loads(path.read_text())
            if config["server"] != server:
                raise RuntimeError("Agent configuration belongs to another server; pair again")
        client.headers["Authorization"] = f"Bearer {config['token']}"
        host = PrinterHost(config["host_type"], args.host, os.getenv("PRINTHUB_HOST_API_KEY", ""))
        log.info("Agent connected; printer %s (%s)", config["printer_id"], config["host_type"])
        while True:
            try:
                try:
                    telemetry = host.telemetry()
                    if args.camera:
                        image = host.client.get(args.camera); image.raise_for_status()
                        if len(image.content) < 900_000:
                            telemetry["camera_snapshot"] = base64.b64encode(image.content).decode()
                except Exception as error:
                    telemetry = {"state": "offline", "message": str(error)}
                state = telemetry.pop("state")
                response = client.post("/agent/heartbeat", json={"state": state, "telemetry": telemetry}); response.raise_for_status()
                for command in response.json()["commands"]:
                    result = {"status": "completed"}
                    try:
                        gcode = None
                        if command["action"] == "print":
                            payload = command["payload"]
                            # Download through the short-lived object-scoped URL
                            # without forwarding the agent's bearer credential.
                            with httpx.Client(timeout=120) as download:
                                artifact = download.get(payload["download_url"])
                                artifact.raise_for_status()
                            gcode = artifact.content
                            if hashlib.sha256(gcode).hexdigest() != payload["sha256"]:
                                raise RuntimeError("G-code checksum mismatch; refusing to print")
                        host.execute(command, gcode)
                    except Exception as error:
                        log.exception("Command failed")
                        result = {"status": "failed", "error": str(error)[:2000]}
                    acknowledgement = client.post(f"/agent/commands/{command['id']}", json=result); acknowledgement.raise_for_status()
            except KeyboardInterrupt:
                return
            except Exception:
                log.exception("Agent heartbeat failed; reconnecting in five seconds")
            time.sleep(5)


if __name__ == "__main__":
    main()
