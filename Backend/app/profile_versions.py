"""Persistence and materialization helpers for immutable slicer profiles."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import slicer_data_path
from app.models import SlicerProfileVersion
from app.profile_import import PROFILE_NAME, PROFILE_TYPES
from app.storage import put_bytes


CATEGORIES = {"printers", "presets", "filaments"}
CATEGORY_TO_TYPE = {
    "printers": PROFILE_TYPES["printer"],
    "presets": PROFILE_TYPES["process"],
    "filaments": PROFILE_TYPES["filament"],
}


class ProfileVersionError(ValueError):
    pass


def validate_process_printer_compatibility(
    printer: SlicerProfileVersion,
    process: SlicerProfileVersion,
) -> None:
    """Reject a process preset whose Orca family does not match the printer.

    Orca desktop profile names such as ``0.12mm Quality @Voron`` and their
    inherited parent usually identify the printer family after ``@``.  A
    process profile for one family must not be paired with a different
    machine, even when an older importer populated ``compatible_printers`` too
    broadly.
    """

    printer_settings = normalize_profile_settings("printers", printer.name, printer.settings)
    process_settings = normalize_profile_settings("presets", process.name, process.settings)
    printer_identity = " ".join(
        str(printer_settings.get(key, ""))
        for key in ("name", "printer_settings_id", "printer_model", "inherits")
    ).lower()

    family = _profile_family(process_settings.get("inherits")) or _profile_family(process_settings.get("name"))
    if family and family not in printer_identity:
        raise ProfileVersionError(
            f"Process profile '{process.name}' is for the {family} printer family, "
            f"but '{printer.name}' was selected. Choose a matching printer and process profile."
        )

    compatible = process_settings.get("compatible_printers")
    if isinstance(compatible, list) and compatible:
        normalized_identity = {
            str(value).strip().lower()
            for value in (printer.name, printer_settings.get("name"), printer_settings.get("printer_settings_id"))
            if isinstance(value, str) and value.strip()
        }
        normalized_compatible = {
            str(value).strip().lower() for value in compatible if isinstance(value, str) and value.strip()
        }
        if not normalized_identity.intersection(normalized_compatible) and not family:
            raise ProfileVersionError(
                f"Process profile '{process.name}' is not compatible with printer '{printer.name}'."
            )


def _profile_family(value: object) -> str:
    if not isinstance(value, str) or "@" not in value:
        return ""
    family = value.rsplit("@", 1)[1].split(" - ", 1)[0].strip().lower()
    return re.sub(r"\s+", " ", family)


def create_profile_version(
    db: Session,
    *,
    owner_id: str,
    category: str,
    name: str,
    settings: dict,
    source_bundle_sha256: str | None = None,
) -> tuple[SlicerProfileVersion, bool]:
    """Append a version unless the latest version already has identical content."""

    normalized = normalize_profile_settings(category, name, settings)
    content = json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(content).hexdigest()

    latest = db.scalar(
        select(SlicerProfileVersion)
        .where(
            SlicerProfileVersion.owner_id == owner_id,
            SlicerProfileVersion.category == category,
            SlicerProfileVersion.name == name,
        )
        .order_by(SlicerProfileVersion.version.desc())
        .limit(1)
    )
    if latest is not None and latest.sha256 == digest:
        return latest, False

    next_version = (latest.version + 1) if latest is not None else 1
    version_id = str(uuid4())
    object_key = f"users/{owner_id}/profiles/{category}/{version_id}.json"
    put_bytes(object_key, content, "application/json")
    version = SlicerProfileVersion(
        id=version_id,
        owner_id=owner_id,
        category=category,
        name=name,
        version=next_version,
        settings=normalized,
        sha256=digest,
        object_key=object_key,
        source_bundle_sha256=source_bundle_sha256,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    db.flush()
    install_profile_file(category, name, normalized)
    return version, True


def latest_profile_version(
    db: Session, *, owner_id: str, category: str, name: str
) -> SlicerProfileVersion:
    """Resolve only a profile version owned by the requesting user."""

    latest = db.scalar(
        select(SlicerProfileVersion)
        .where(
            SlicerProfileVersion.owner_id == owner_id,
            SlicerProfileVersion.category == category,
            SlicerProfileVersion.name == name,
        )
        .order_by(SlicerProfileVersion.version.desc())
        .limit(1)
    )
    if latest is not None:
        return latest
    raise ProfileVersionError(f"Slicer profile not found: {category}/{name}")


def materialize_task_profiles(
    printer: SlicerProfileVersion,
    process: SlicerProfileVersion,
    filament: SlicerProfileVersion,
) -> tuple[str, str, str]:
    """Write immutable task inputs under unique names understood by the slicer API."""

    printer_alias = f"ph-{printer.id}"
    # Process compatibility depends on the chosen printer. Include both IDs so
    # concurrent jobs using one process with different printers never rewrite
    # the same materialized file with different compatibility metadata.
    process_alias = f"ph-{process.id}-{printer.id}"
    filament_alias = f"ph-{filament.id}"

    # Profile rows created by older application versions may not contain the
    # discriminator required by OrcaSlicer's CLI.  Normalize at the final
    # boundary as well as at import time so those rows cannot reach the
    # slicer as an untyped JSON preset.
    printer_settings = normalize_profile_settings("printers", printer.name, printer.settings)
    process_settings = normalize_profile_settings("presets", process.name, process.settings)
    filament_settings = normalize_profile_settings("filaments", filament.name, filament.settings)

    compatible = process_settings.get("compatible_printers")
    compatible_names = list(compatible) if isinstance(compatible, list) else []
    for candidate in (
        printer_alias,
        printer.name,
        printer_settings.get("name"),
        printer_settings.get("printer_settings_id"),
        printer_settings.get("inherits"),
    ):
        if isinstance(candidate, str) and candidate and candidate not in compatible_names:
            compatible_names.append(candidate)
    process_settings["compatible_printers"] = compatible_names

    install_profile_file("printers", printer_alias, printer_settings)
    install_profile_file("presets", process_alias, process_settings)
    install_profile_file("filaments", filament_alias, filament_settings)
    return printer_alias, process_alias, filament_alias


def install_profile_file(category: str, name: str, settings: dict) -> None:
    expected_type = CATEGORY_TO_TYPE.get(category)
    if expected_type is None:
        raise ProfileVersionError(f"Unsupported slicer profile category: {category}")
    if settings.get("type") != expected_type:
        raise ProfileVersionError(
            f"{category}/{name} has type {settings.get('type')!r}; expected {expected_type!r}"
        )
    destination_dir = Path(slicer_data_path()) / category
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{name}.json"
    raw = json.dumps(settings, ensure_ascii=False, indent=2).encode("utf-8")
    with tempfile.NamedTemporaryFile(
        dir=destination_dir, prefix=".version-", suffix=".json", delete=False
    ) as temporary:
        temporary.write(raw)
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, destination)


def _validate(category: str, name: str, settings: dict) -> None:
    if category not in CATEGORIES:
        raise ProfileVersionError("Profile category must be printers, presets, or filaments")
    if not PROFILE_NAME.fullmatch(name):
        raise ProfileVersionError("Profile name contains unsupported characters")
    if not isinstance(settings, dict) or not settings:
        raise ProfileVersionError("Profile settings must be a non-empty JSON object")


def normalize_profile_settings(category: str, name: str, settings: dict) -> dict:
    """Return CLI-safe profile JSON without changing user-selected settings.

    OrcaSlicer desktop exports commonly omit ``type``.  The desktop app can
    infer it from the file's context, but the headless CLI cannot.  Always
    write the canonical discriminator immediately before a profile is stored
    or materialized for a slicing task.  This also repairs rows imported by
    older PrintHub builds.
    """

    _validate(category, name, settings)
    normalized = dict(settings)
    normalized["type"] = CATEGORY_TO_TYPE[category]
    # Orca's CLI accepts lowercase "system" and "User"/"user", but rejects
    # desktop exports containing the otherwise equivalent capitalized "System".
    normalized["from"] = "system" if str(normalized.get("from", "User")).lower() == "system" else "User"
    # A few hand-authored profiles omit the display name.  The database name
    # is the safest fallback and does not alter any slicer setting values.
    if not isinstance(normalized.get("name"), str) or not normalized["name"].strip():
        normalized["name"] = name
    return normalized
