# Testing

## Automated suites

Run from the project root unless noted.

| Suite | Needs | Command |
|---|---|---|
| API unit tests (SQLite, mocked host) | Nothing | `cd Backend; ../.ph_venv/bin/python -m unittest discover -s tests -v` |
| PostgreSQL queue concurrency | Running stack (DB on `127.0.0.1:5433`) | `cd Backend; PRINTHUB_PG_TEST_URL=postgresql+psycopg://printhub:change-me@127.0.0.1:5433/postgres ../.ph_venv/bin/python -m unittest tests.test_postgres_queue -v` |
| Slicer service contract (fake CLI) | Node | `cd Deployments/self-hosted/slicer; npm ci; npm test` |
| Workspace + geometry smoke | Vite on 5174 | `cd Frontend; npm run test:workspace; npm run test:geometry` |
| Lazy-loading check | `npm run build` then `npm run preview` | `cd Frontend; npm run test:performance` |
| Stack health | Running stack | `fish scripts/verify-self-hosted.fish` |
| End-to-end | Running stack | `.ph_venv/bin/python scripts/e2e-self-hosted.py` |

Notes:

- Frontend smoke tests need `npm ci`, `npx playwright install chromium` and `npm run dev -- --port 5174` in another terminal. They mock the API. Set `PRINTHUB_TEST_URL` for another Vite URL and `PRINTHUB_STEP_FIXTURE=/abs/path.step` for a real STEP import.
- The concurrency suite creates and drops its own database. It races eight workers to prove no double claim, lock skipping, single reclaim of expired leases and single dead-lettering.
- The end-to-end script logs in through Keycloak's form, uploads via signed URL, slices with real OrcaSlicer, checks G-code checksum, cross-user isolation and cancellation, and sends a print to the agent in simulator mode. It creates and deletes two temporary Keycloak users. It never contacts a physical printer.
- `verify-self-hosted.fish` checks all services, health endpoints, Alembic revision, tables, slicer health, ports and the React page. It sends no print command.
- SQLite tests do not cover PostgreSQL row locking; use the concurrency suite for that.
- [scripts/README.md](../scripts/README.md) describes each stack script in detail.

## Checkpoint demonstration (self-hosted)

### 1. Stack and migration

```fish
fish scripts/start-local.fish --detach
curl -s http://localhost:8080/health/ready
podman logs --tail=30 printhub_worker_1
podman exec printhub_postgres_1 psql -U printhub -d printhub -c "SELECT version_num FROM alembic_version;"
```

Expected revision: `006_workspace_printers`.

### 2. Immutable profiles

Import an `.orca_printer` bundle, then:

```fish
podman exec printhub_postgres_1 psql -U printhub -d printhub -c \
  "SELECT category, name, version, left(sha256, 12) FROM slicer_profile_versions ORDER BY 1, 2, 3;"
```

Changed settings add a version; identical settings reuse one.

### 3. Signed upload and slice

In DevTools → Network, slice a plate and show:

1. `POST /api/v1/files/upload-url`
2. `PUT /printhub-artifacts/users/...?...X-Amz-Signature=...` (bytes bypass FastAPI)
3. `POST /api/v1/files/{id}/complete`
4. `POST /api/v1/slice-jobs` with `Idempotency-Key`

```fish
podman exec printhub_postgres_1 psql -U printhub -d printhub -x -c \
  "SELECT j.status, t.attempt_count, t.printer_profile_version_id, t.process_profile_version_id,
          t.filament_profile_version_id, f.sha256 AS model_sha256, t.gcode_sha256
   FROM print_jobs j JOIN print_tasks t ON t.job_id = j.id JOIN stl_files f ON f.id = t.file_id
   ORDER BY j.created_at DESC LIMIT 1;"
```

Expected: `completed`, attempt `1`, three version IDs, two SHA-256 values.

### 4. Crash recovery

```fish
podman stop printhub_worker_1
# submit a slice from the dashboard
podman exec printhub_postgres_1 psql -U printhub -d printhub -c \
  "UPDATE print_tasks SET status='slicing', attempt_count=1, lease_owner='crashed-worker',
          lease_expires_at=NOW() - INTERVAL '1 second'
   WHERE id=(SELECT id FROM print_tasks ORDER BY created_at DESC LIMIT 1);"
podman start printhub_worker_1
podman logs -f printhub_worker_1
```

Expected: the worker reclaims it as attempt 2 and completes it.

### 5. Dead-letter after five attempts

```fish
podman stop printhub_slicer_1
# submit a slice, watch the worker retry
podman exec printhub_postgres_1 psql -U printhub -d printhub -x -c \
  "SELECT j.status, t.attempt_count, t.dead_lettered_at, t.error_message
   FROM print_jobs j JOIN print_tasks t ON t.job_id = j.id ORDER BY j.created_at DESC LIMIT 1;"
podman start printhub_slicer_1
```

Expected: `dead-lettered`, `attempt_count=5`, error and timestamp set. Retries back off 5, 10, 20, 40 s, so this takes about 75 s plus slicer timeouts.

### 6. Printer (simulator)

Register a Simulator printer in **Device**, pair the agent ([Using PrintHub](using-printhub.md#5-connect-a-printer)), print a completed job, and show progress and the command history.
