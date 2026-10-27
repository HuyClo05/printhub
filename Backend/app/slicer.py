"""HTTP client for the private OrcaSlicer API worker."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import httpx

from app.config import setting


class SlicerError(RuntimeError):
    """Raised when the private slicer cannot complete an operation."""


@dataclass(frozen=True)
class SliceOutput:
    content: bytes
    print_time_seconds: int | None
    filament_used_g: float | None
    filament_used_mm: float | None


class SlicerClient:
    def __init__(self) -> None:
        self.base_url = (setting("SLICER_URL", "http://slicer:3000") or "http://slicer:3000").rstrip("/")
        self.timeout_seconds = max(float(setting("SLICER_TIMEOUT_SECONDS", "900") or "900"), 30.0)

    async def list_profiles(self, category: str) -> list[str]:
        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.get(f"{self.base_url}/profiles/{category}")
        if response.status_code >= 400:
            raise SlicerError(f"Slicer profile lookup failed ({response.status_code})")
        payload = response.json()
        if not isinstance(payload, list) or not all(isinstance(item, str) for item in payload):
            raise SlicerError("Slicer returned an invalid profile list")
        return payload

    async def resolved_profile(self, category: str, name: str) -> dict | None:
        """Return a system profile merged with its inherits chain, or None if unknown."""

        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.get(f"{self.base_url}/profiles/{category}/{quote(name, safe='')}")
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            raise SlicerError(f"Slicer profile lookup failed ({response.status_code})")
        payload = response.json()
        if not isinstance(payload, dict):
            raise SlicerError("Slicer returned an invalid profile")
        return payload

    async def slice_model(
        self,
        *,
        filename: str,
        model: bytes,
        printer_profile: str,
        process_profile: str,
        filament_profile: str,
        printer_profile_data: bytes | None = None,
        process_profile_data: bytes | None = None,
        filament_profile_data: bytes | None = None,
        request_id: str | None = None,
        calibration_kind: str | None = None,
        arrange: bool,
        orient: bool,
    ) -> SliceOutput:
        data = {
            "printer": printer_profile,
            "preset": process_profile,
            "filament": filament_profile,
            "exportType": "gcode",
        }
        if request_id:
            data["requestId"] = request_id
        if calibration_kind:
            data["calibrationKind"] = calibration_kind
        # Manual transforms are baked into the prepared 3MF. Arrangement is
        # opt-in; orientation is never delegated to the headless service.
        if arrange:
            data["arrange"] = "true"
        if orient:
            data["orient"] = "true"
        # Preserve the prepared 3MF extension and normalize mixed-case STL.
        slicer_filename = _stl_filename(filename)
        files = {"file": (slicer_filename, model, "model/3mf" if slicer_filename.endswith('.3mf') else "model/stl")}
        # The upstream API supports per-request profile uploads. Use the
        # immutable profile JSON selected for this task when available, so a
        # shared slicer data directory cannot resolve a stale/colliding file.
        if printer_profile_data is not None and process_profile_data is not None:
            files["printerProfile"] = ("printer.json", printer_profile_data, "application/json")
            files["presetProfile"] = ("preset.json", process_profile_data, "application/json")
            if filament_profile_data is not None:
                files["filamentProfile"] = ("filament.json", filament_profile_data, "application/json")

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as http:
                response = await http.post(
                    f"{self.base_url}/slice",
                    data=data,
                    files=files,
                )
        except httpx.HTTPError as error:
            raise SlicerError(f"Could not reach the slicer: {error}") from error

        if response.status_code >= 400:
            detail = response.text[:1000]
            raise SlicerError(f"Slicer rejected the model ({response.status_code}): {detail}")

        return SliceOutput(
            content=response.content,
            print_time_seconds=_int_header(response.headers.get("x-print-time-seconds")),
            filament_used_g=_float_header(response.headers.get("x-filament-used-g")),
            filament_used_mm=_float_header(response.headers.get("x-filament-used-mm")),
        )

    async def cancel(self, request_id: str) -> None:
        async with httpx.AsyncClient(timeout=10) as http:
            await http.post(f"{self.base_url}/slice/{request_id}/cancel")


def _int_header(value: str | None) -> int | None:
    try:
        return int(float(value)) if value is not None else None
    except ValueError:
        return None


def _float_header(value: str | None) -> float | None:
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def _stl_filename(filename: str) -> str:
    """Return a safe filename that the slicer recognizes as an STL model."""

    candidate = Path(filename or "model.stl").name
    if candidate.lower().endswith(".3mf"):
        return f"{Path(candidate).stem}.3mf"
    if candidate.lower().endswith(".stl"):
        return f"{Path(candidate).stem}.stl"
    return "model.stl"
