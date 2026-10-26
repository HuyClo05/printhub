# PrintHub backend

This directory contains the FastAPI control plane, Alembic migrations, and the self-hosted durable slicing worker.

It also contains the first health endpoints:

- `GET /health/live` confirms that the API process is running.
- `GET /health/ready` checks PostgreSQL and the configured S3-compatible bucket.
- `GET /api/v1/me` returns the identity from a validated bearer token.
- `GET /api/v1/resources/{resource_id}` returns only resources owned by that identity.
- `POST /api/v1/files/upload-url` creates a direct, short-lived SeaweedFS upload URL.
- `POST /api/v1/slice-jobs` queues an idempotent slice referencing immutable profile versions.
- `python -m app.worker` claims jobs with renewable PostgreSQL leases and retries them up to five times.

## Tables

- `users` stores authenticated users.
- `resources` stores a minimal user-owned record used to prove ownership isolation.
- `slicer_profile_versions` stores append-only profile metadata and checksums.
- `stl_files` stores owned object keys and model checksums.
- `print_jobs` and `print_tasks` form the durable self-hosted queue.
- `idempotency_records` prevents duplicate slice jobs when a request is retried.

## Local setup

Create a virtual environment and install dependencies:

```sh
cd /home/huyv/Projects/Printhub
python -m venv .ph_venv
. .ph_venv/bin/activate
python -m pip install -r Backend/requirements.txt
```

The environment is stored at the project root as `.ph_venv`, so it can be used
for all Python-based PrintHub tools. The Vue frontend has its own Node/npm
dependencies and does not use this environment.

Set `DATABASE_URL` to a reachable PostgreSQL database:

```sh
export DATABASE_URL='postgresql+psycopg://printhub:change-me@localhost:5432/printhub'
```

Set the object-storage values as well. For local SeaweedFS:

```sh
export S3_ENDPOINT='http://localhost:8333'
export S3_BUCKET='printhub-artifacts'
export S3_ACCESS_KEY='printhub'
export S3_SECRET_KEY='change-me'
export AWS_REGION='us-east-1'
```

For Keycloak, also set the OIDC values:

```sh
export OIDC_ISSUER='http://localhost:8080/realms/printhub'
export OIDC_JWKS_URL='http://localhost:8080/realms/printhub/protocol/openid-connect/certs'
```

`/api/v1/me` and `/api/v1/resources/{resource_id}` require an
`Authorization: Bearer <token>` header. The API validates the token signature,
expiry, and issuer using the provider's JWKS keys. The resource query filters
by both resource ID and token subject, so a user receives `404` rather than
being told that another user's resource exists.

Start the API with:

```sh
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal, test liveness:

```sh
curl -i http://localhost:8000/health/live
```

Test readiness:

```sh
curl -i http://localhost:8000/health/ready
```

Readiness returns `200` only when both PostgreSQL and the object-storage bucket are reachable. It returns `503` and identifies the failed check when a dependency is unavailable. Detailed connection errors are written to the API logs, not returned to the browser.

Run migrations from the backend directory:

```sh
cd Backend
alembic upgrade head
```

Check the migration status:

```sh
alembic current
```

When the API is containerized, run the same migration against the Compose database:

```sh
podman compose run --rm api alembic upgrade head
```

## Start the complete local development stack

From the project root, Fish users can start the complete self-hosted stack with
one command:

```fish
fish scripts/start-local.fish
```

This starts PostgreSQL, Keycloak, SeaweedFS, the private OrcaSlicer service, the API, the durable worker, the frontend, and Caddy.
The script uses containers, so activating `.ph_venv` first is optional. The
`.ph_venv` environment remains useful for running local migrations, tests, and
Python development outside the containers.

For a deployment-like background run:

```fish
fish scripts/start-local.fish --detach
```

Stop the stack with:

```fish
fish scripts/stop-local.fish
```

See [scripts/README.md](../scripts/README.md) for details on each script.
