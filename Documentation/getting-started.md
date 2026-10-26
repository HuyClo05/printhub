# Getting Started

## Requirements

- Linux with rootless Podman 5+ and a Compose provider (`podman compose version` must work).
- Fish shell for the helper scripts.
- About 16 GB RAM for the full stack while slicing.
- Python 3 for `.ph_venv` (migrations, tests, printer agent). Node 20.19+ or 22.12+ for frontend development.

## First run

```fish
cp .ph_env.example .ph_env      # edit passwords before exposing the host
fish scripts/start-local.fish --detach
```

The script pulls images, builds the API, slicer and frontend images, then starts the stack. The first build downloads OrcaSlicer and can take several minutes. The API container applies Alembic migrations on startup; existing volumes are kept.

Open `http://localhost:8080`. Keycloak's admin console is at `http://localhost:8080/admin/`. Create users in the `printhub` realm there.

Omit `--detach` to run in the foreground. Stop the stack with:

```fish
fish scripts/stop-local.fish
```

Check that everything is healthy:

```fish
fish scripts/verify-self-hosted.fish
```

See [scripts/README.md](../scripts/README.md) for what each script does.

## Services

| Service | Role | Exposed |
|---|---|---|
| `caddy` | Single entry point; routes by path | `8080` |
| `frontend` | Static React bundle | via Caddy `/` |
| `api` | FastAPI control plane | via Caddy `/api/*`, `/health/*` |
| `keycloak` | OIDC login (realm `printhub`, client `printhub-frontend`) | via Caddy `/realms/*`, `/admin/*`, `/resources/*`, `/js/*` |
| `seaweedfs` | S3-compatible object storage | via Caddy `/printhub-artifacts/*` (signed URLs only) |
| `postgres` | PostgreSQL 17 | `127.0.0.1:5433` (loopback only) |
| `worker` | Durable slicing worker (`python -m app.worker`) | no |
| `slicer` | Private OrcaSlicer 2.4.2 HTTP service | no |

## Configuration

All values live in `.ph_env` and are passed to Compose with `--env-file`. Main groups:

| Group | Variables |
|---|---|
| Database | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` |
| Object storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `AWS_REGION` |
| Identity | `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_ID`, `OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE` |
| Worker / slicer | `SLICER_URL`, `SLICER_DATA_PATH`, `SLICER_TIMEOUT_SECONDS` (900), `WORKER_LEASE_SECONDS` (90), `WORKER_POLL_SECONDS` (2), `WORKER_RETRY_BASE_SECONDS` (5) |
| Frontend build | `VITE_API_URL`, `VITE_OIDC_*` (public values only; baked into the bundle) |
| Public address | `FRONTEND_URL` (used in signed upload URLs) |

Keep `S3_BUCKET=printhub-artifacts` unless you also change the Caddy route. Never put secrets in `VITE_*` variables.

## Running parts outside containers

```fish
python -m venv .ph_venv
.ph_venv/bin/pip install -r Backend/requirements.txt
cd Backend
../.ph_venv/bin/alembic upgrade head
../.ph_venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Set `DATABASE_URL`, the `S3_*` values and `OIDC_ISSUER` in the environment first (see `Backend/.env.example`). Against the Compose database use `127.0.0.1:5433`.

Frontend dev server:

```sh
cd Frontend
npm install
npm run dev
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Containers restart | `podman logs printhub_<service>_1`, disk space, `.ph_env` values |
| `/health/ready` returns 503 | Response names the failed check: PostgreSQL or the S3 bucket |
| Login redirects wrongly | Keycloak client redirect URIs vs. the browser URL; `OIDC_ISSUER` |
| Port 8080 in use | Change only the Caddy host port in `compose.yml` |
| Upload fails | URL expired (10 min), `FRONTEND_URL` mismatch, SeaweedFS logs |
| Slice stuck or retrying | `podman logs printhub_worker_1` and `printhub_slicer_1` |
| Old UI after rebuild | Reload the browser once |
| Agent cannot pair | Code expired (10 min) or already used; agent must reach `--server` |
