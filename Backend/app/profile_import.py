"""Safe importer for OrcaSlicer ``.orca_printer`` profile bundles."""

from __future__ import annotations

import json
import os
import re
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from app.config import slicer_data_path


class ProfileBundleError(ValueError):
    """Raised when an uploaded profile bundle is invalid or unsafe."""


MAX_BUNDLE_BYTES = 25 * 1024 * 1024
MAX_MEMBER_BYTES = 5 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
DIRECTORIES = {"printer": "printers", "filament": "filaments", "process": "presets"}
PROFILE_TYPES = {"printer": "machine", "process": "process", "filament": "filament"}
PROFILE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 @()._+\-]*$")


def import_orca_bundle(content: bytes) -> dict[str, list[str]]:
    """Validate and atomically copy bundle JSON into the slicer data volume."""

    if len(content) > MAX_BUNDLE_BYTES:
        raise ProfileBundleError("The profile bundle is larger than 25 MB")

    try:
        archive = zipfile.ZipFile(io_bytes(content))
    except (OSError, zipfile.BadZipFile) as error:
        raise ProfileBundleError("The uploaded file is not a valid ZIP profile bundle") from error

    members = [member for member in archive.infolist() if not member.is_dir()]
    if not members or len(members) > 100:
        raise ProfileBundleError("The profile bundle has an invalid file count")
    if sum(member.file_size for member in members) > MAX_UNCOMPRESSED_BYTES:
        raise ProfileBundleError("The profile bundle expands beyond the allowed size")

    staged: list[tuple[str, str, dict[str, object]]] = []
    seen_paths: set[str] = set()
    structure = None
    for member in members:
        name = member.filename
        validate_member_path(name)
        if name in seen_paths:
            raise ProfileBundleError("The profile bundle contains duplicate paths")
        seen_paths.add(name)
        if member.file_size > MAX_MEMBER_BYTES:
            raise ProfileBundleError(f"Profile file is too large: {name}")
        if is_symlink(member):
            raise ProfileBundleError("Symbolic links are not allowed in profile bundles")

        raw = archive.read(member)
        if name == "bundle_structure.json":
            try:
                structure = json.loads(raw)
            except json.JSONDecodeError as error:
                raise ProfileBundleError("bundle_structure.json is invalid JSON") from error
            if not isinstance(structure, dict):
                raise ProfileBundleError("bundle_structure.json must contain an object")
            continue

        parts = PurePosixPath(name).parts
        if len(parts) != 2 or parts[0] not in DIRECTORIES or not name.endswith(".json"):
            raise ProfileBundleError(f"Unsupported bundle member: {name}")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ProfileBundleError(f"Invalid JSON profile: {name}") from error
        if not isinstance(parsed, dict):
            raise ProfileBundleError(f"Profile must contain a JSON object: {name}")
        # OrcaSlicer desktop exports omit this discriminator, but the CLI
        # requires it when a JSON profile is supplied through --load-settings
        # or --load-filaments.
        parsed["type"] = PROFILE_TYPES[parts[0]]
        profile_name = Path(parts[1]).stem
        if not PROFILE_NAME.fullmatch(profile_name):
            raise ProfileBundleError(f"Unsupported profile name: {profile_name}")
        staged.append((DIRECTORIES[parts[0]], profile_name, parsed))

    if structure is None:
        raise ProfileBundleError("bundle_structure.json is required")
    if not staged:
        raise ProfileBundleError("The bundle contains no profile JSON files")

    root = Path(slicer_data_path())
    compatible_printers = set()
    for path in (root / "printers").glob("*.json"):
        compatible_printers.add(path.stem)
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            existing = {}
        if isinstance(existing, dict):
            add_printer_aliases(compatible_printers, existing)

    for category, name, parsed in staged:
        if category == "printers":
            compatible_printers.add(name)
            add_printer_aliases(compatible_printers, parsed)

    compatible_printers = sorted(compatible_printers)
    imported: dict[str, list[str]] = {"printers": [], "presets": [], "filaments": []}
    for category, name, parsed in staged:
        # GUI exports inherit compatibility from the parent preset. The CLI
        # does not reliably resolve that relationship for user presets, so
        # make the installed printer choices explicit for process profiles.
        if category == "presets" and compatible_printers:
            if not parsed.get("compatible_printers"):
                parsed["compatible_printers"] = compatible_printers
        raw = json.dumps(parsed, ensure_ascii=False, indent=2).encode("utf-8")
        destination_dir = root / category
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / f"{name}.json"
        with tempfile.NamedTemporaryFile(dir=destination_dir, prefix=".import-", suffix=".json", delete=False) as temporary:
            temporary.write(raw)
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, destination)
        imported[category].append(name)

    return imported


def validate_member_path(name: str) -> None:
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
        raise ProfileBundleError("Unsafe path in profile bundle")


def add_printer_aliases(names: set[str], profile: dict[str, object]) -> None:
    """Collect machine identities OrcaSlicer may use for compatibility checks."""

    for key in ("name", "printer_settings_id", "inherits"):
        value = profile.get(key)
        if isinstance(value, str) and value:
            names.add(value)


def is_symlink(member: zipfile.ZipInfo) -> bool:
    return ((member.external_attr >> 16) & 0o170000) == 0o120000


def io_bytes(content: bytes):
    from io import BytesIO

    return BytesIO(content)
