# API

Base path `/api/v1`, served through Caddy at `http://localhost:8080`. FastAPI's interactive `/docs` page is available only when running the API directly on port 8000; Caddy does not route it.

## Authentication

| Caller | Header | Source |
|---|---|---|
| User | `Authorization: Bearer <access token>` | Keycloak, Authorization Code + PKCE |
| Agent | `Authorization: Bearer <agent token>` | `POST /agent/pair` |

Missing or invalid user tokens return `401`. Every user route is scoped to the token's `sub`; other users' resources return `404`. The first authenticated write creates the `users` row.

## Endpoints

### Health and identity

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health/live` | Process is running |
| `GET` | `/health/ready` | PostgreSQL and S3 bucket reachable (`200` / `503`) |
| `GET` | `/api/v1/me` | Identity from the token |
| `GET` | `/api/v1/resources/{id}` | Ownership-isolation check record |

### Models

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/files/upload-url` | Create a pending `.stl`/`.3mf` record and a 10-minute signed PUT URL |
| `POST` | `/files/{id}/complete` | Verify the uploaded size; mark `ready` |
| `GET` | `/files` | List ready models (latest 200) |
| `GET` | `/files/{id}/content` | Download a stored model |

### Profiles

Categories: `printers`, `presets` (process), `filaments`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/slicer/profile-bundles` | Import `.orca_printer`/`.zip` (multipart `bundle`, max 25 MB) |
| `GET` | `/slicer/profiles/{category}` | List profile names |
| `GET` | `/slicer/profiles/{category}/{name}` | Latest settings for one profile |
| `POST` | `/profiles` | Create a version from JSON settings |
| `GET` | `/profiles` | List all owned versions |
| `GET` | `/profiles/{version_id}` | One version with settings |

### Slice jobs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/slice-jobs` | Queue a slice (`202`); accepts `Idempotency-Key` |
| `GET` | `/slice-jobs` | List jobs (`limit` 1–500, default 100) |
| `GET` | `/slice-jobs/{id}` | Status, attempts, profile versions, checksums, stats |
| `GET` | `/slice-jobs/{id}/gcode` | Download G-code (`409` until completed) |
| `POST` | `/slice-jobs/{id}/cancel` | Cancel unless completed |
| `POST` | `/slice-jobs/{id}/retry` | Requeue a failed, dead-lettered or cancelled job |

`POST /slice-jobs` body: `file_id`, `printer_profile`, `process_profile`, `filament_profile`, optional `*_profile_version_id` to pin older versions, `process_overrides` (saved as a new process version), `filament_profiles` (extra slots), `calibration`, `arrange`, `orient`. The process preset must be compatible with the printer preset.

### Printers

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/printers` | List printers with state and telemetry |
| `POST` | `/printers` | Register (`name`, `model`, `host_type`, `profile_name`) |
| `DELETE` | `/printers/{id}` | Remove (`409` while printing or paused) |
| `POST` | `/printers/{id}/pair` | New pairing code; revokes the current agent |
| `POST` | `/printers/{id}/commands` | Queue `print`, `pause`, `resume`, `stop`, `home`, `jog`, `extrude` |
| `GET` | `/printers/{id}/commands` | Last 30 commands |

`host_type` is `moonraker`, `octoprint` or `simulator`. Motion commands require a `ready` printer; `distance` is −50 to 50 mm.

### Agent

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/agent/pair` | Redeem a code; returns `token`, `printer_id`, `host_type` (no auth) |
| `POST` | `/agent/heartbeat` | Report `state` + `telemetry` (≤ 1.5 MB); receive up to one command |
| `POST` | `/agent/commands/{id}` | Acknowledge `completed` or `failed` |
| `GET` | `/agent/jobs/{job_id}/gcode?command_id=` | Fallback G-code download with `X-Content-SHA256` |

## Idempotency

Only `POST /slice-jobs` uses `Idempotency-Key`. The server stores `(owner, endpoint, key)` with a hash of the request body.

- Same key, same body: returns the original job.
- Same key, different body: `409`.

## Job states

```text
queued -> slicing -> completed
             |
             +-> retrying -> slicing      (attempts 1–4)
             +-> dead-lettered            (after attempt 5)
queued / slicing / retrying -> cancelled
failed / dead-lettered / cancelled -> queued   (retry endpoint)
```

`completed` means G-code exists, not that anything was printed. Printer states are `ready`, `printing`, `paused`, `error`, `offline`.
