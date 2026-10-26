# Data Model

PostgreSQL holds metadata and state. SeaweedFS holds models and G-code. SQLAlchemy models are in `Backend/app/models/`.

## Tables

| Table | Purpose | Key fields |
|---|---|---|
| `users` | One row per token subject | `id` = OIDC `sub`, `email` |
| `slicer_profile_versions` | Immutable printer/process/filament versions | `owner_id`, `category`, `name`, `version`, `settings` (JSONB), `sha256` |
| `stl_files` | Uploaded models (STL or 3MF) | `uploaded_by`, `stl_url` (object key), `sha256`, `upload_status` |
| `print_jobs` | User-facing slice job | `created_by`, `job_name`, `status` |
| `print_tasks` | Queue row for one job | profile version IDs, `attempt_count`/`max_attempts`, `lease_owner`, `lease_expires_at`, `available_at`, `gcode_key`, `gcode_sha256`, stats, `dead_lettered_at` |
| `idempotency_records` | Replay protection | unique `(owner_id, endpoint, key)`, `request_hash`, `resource_id` |
| `printers` | Registered printers | `owner_id`, `name`, `state`, `last_seen` |
| `printer_connections` | Agent link per printer | `host_type`, `profile_name`, `pairing_hash`, `pairing_expires_at`, `token_hash`, `telemetry` |
| `printer_commands` | Commands for the agent | `action`, `payload`, `status` (`queued`/`delivered`/`completed`/`failed`) |
| `profiles`, `resources` | Early-checkpoint tables; `resources` backs the ownership check endpoint | — |

```text
users 1─* slicer_profile_versions
users 1─* stl_files 1─* print_tasks
users 1─* print_jobs 1─1 print_tasks *─3 slicer_profile_versions
users 1─* printers 1─1 printer_connections
               printers 1─* printer_commands
```

## Ownership

Every user-owned row stores the token subject. Every query filters by it; client-supplied owner IDs are never trusted. A request for another user's row returns `404`, so existence is not revealed.

## Profile versioning

- Versions are append-only; settings are never edited in place.
- Saving settings identical to the latest version reuses it (matched by SHA-256).
- Each task pins the exact printer, process and filament version IDs, so old G-code stays traceable.
- Process overrides from the workspace become a new version before the task is queued.

## Object keys

```text
users/{sub}/models/{file_id}/{filename}     uploaded model
users/{sub}/gcode/{job_id}/{sha256}.gcode    sliced G-code
```

## Migrations

Alembic, in `Backend/alembic/versions/`. The API container runs `alembic upgrade head` on every start.

| Revision | Change |
|---|---|
| `001_create_initial_schema` | `users`, `resources` |
| `002_print_workflow_schema` | Printers, profiles, files, jobs, tasks |
| `003_simplify_initial_workflow` | Simplified job/task workflow |
| `004_add_slicing_job_state` | Slicing states and results |
| `005_self_hosted_slice_pipeline` | Profile versions, leases, retries, idempotency |
| `006_workspace_printers` | Printer connections and commands |

Check the current revision:

```fish
podman exec printhub_postgres_1 psql -U printhub -d printhub -c "SELECT version_num FROM alembic_version;"
```

## Retention

Not implemented. Models and G-code are kept until removed manually. Planned default: G-code 30 days after printing, models 90 days, profile versions while referenced.
