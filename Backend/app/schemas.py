"""API response schemas for the Checkpoint 1 endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class MeResponse(BaseModel):
    """The authenticated identity returned by ``/api/v1/me``."""

    id: str
    email: str | None = None
    issuer: str


class ResourceResponse(BaseModel):
    """A resource that belongs to the authenticated user."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    name: str
    created_at: datetime


class ModelFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    file_size: int
    uploaded_at: datetime
    sha256: str | None = None
    upload_status: str


class UploadUrlCreate(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_size: int = Field(gt=0, le=50 * 1024 * 1024)
    content_type: str = Field(default="application/octet-stream", min_length=1, max_length=255)
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")


class UploadUrlResponse(BaseModel):
    file_id: str
    upload_url: str
    expires_at: datetime
    method: str = "PUT"


class CalibrationOptions(BaseModel):
    kind: Literal["Temperature", "Pressure Advance", "Flow Ratio", "Retraction", "Volumetric Speed"]
    start: float = Field(allow_inf_nan=False)
    end: float = Field(allow_inf_nan=False)
    step: float = Field(allow_inf_nan=False)
    bandHeight: float = Field(default=5, ge=1, le=50)


class SliceJobCreate(BaseModel):
    file_id: str = Field(min_length=1, max_length=36)
    printer_profile: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9 @()._+\-]*$")
    process_profile: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9 @()._+\-]*$")
    filament_profile: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9 @()._+\-]*$")
    arrange: bool = False
    orient: bool = False
    printer_profile_version_id: str | None = None
    process_profile_version_id: str | None = None
    filament_profile_version_id: str | None = None
    process_overrides: dict[str, Any] = Field(default_factory=dict)
    filament_profiles: list[str] = Field(default_factory=list, max_length=16)
    calibration: CalibrationOptions | None = None


class SliceJobResponse(BaseModel):
    id: str
    file_id: str
    status: str
    printer_profile: str | None = None
    process_profile: str | None = None
    filament_profile: str | None = None
    printer_profile_version_id: str | None = None
    process_profile_version_id: str | None = None
    filament_profile_version_id: str | None = None
    arrange: bool
    orient: bool
    print_time_seconds: int | None = None
    filament_used_g: float | None = None
    filament_used_mm: float | None = None
    error_message: str | None = None
    attempt_count: int = 0
    max_attempts: int = 5
    model_sha256: str | None = None
    gcode_sha256: str | None = None
    dead_lettered_at: datetime | None = None


class SlicerProfileCreate(BaseModel):
    category: str = Field(pattern=r"^(printers|presets|filaments)$")
    name: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9 @()._+\-]*$")
    settings: dict[str, Any]
    note: str | None = Field(default=None, max_length=500)


class SlicerProfileRestore(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class SlicerProfileVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    name: str
    version: int
    sha256: str
    created_at: datetime
    note: str | None = None
    restored_from_id: str | None = None


class ProfileListResponse(BaseModel):
    category: str
    profiles: list[str]


class ProfileDetailResponse(BaseModel):
    category: str
    name: str
    settings: dict[str, Any]
