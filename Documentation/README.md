# PrintHub Documentation

PrintHub is a self-hosted web platform for preparing and running 3D prints. Users arrange models in a browser workspace, slice them with a private OrcaSlicer service, preview the G-code, and send it to a printer through an outbound-only agent on the printer's LAN.

## Read in this order

| Document | What it covers |
|---|---|
| [Getting started](getting-started.md) | Run, configure, stop and troubleshoot the self-hosted stack |
| [Using PrintHub](using-printhub.md) | Workspace, slicing, preview, printer pairing and current limits |
| [Architecture](architecture.md) | Services, request flows, security and failure handling |
| [API](api.md) | Authentication, endpoints, idempotency and job states |
| [Data model](data-model.md) | Tables, ownership, profile versioning and migrations |
| [Testing](testing.md) | Automated suites and the checkpoint demonstration script |
| [AWS (planned)](aws.md) | Target AWS mapping; not implemented yet |

[archive/](archive/) holds the original Checkpoint 1 beginner guide for reference. It describes an earlier design and is not kept up to date.

## Repository layout

```text
Backend/                 FastAPI API, slicing worker, printer agent, Alembic migrations, tests
Frontend/                React + Three.js workspace (Vite), Playwright smoke tests
Deployments/self-hosted/ Podman Compose stack, Caddyfile, Keycloak realm, slicer service
scripts/                 start/stop/verify the stack, end-to-end test (see scripts/README.md)
.ph_env                  Local configuration (copy from .ph_env.example; not committed)
.ph_venv                 Host Python environment for migrations, tests and the agent
```

## Status

| Area | State |
|---|---|
| Self-hosted stack (Keycloak, PostgreSQL, SeaweedFS, API, worker, slicer, Caddy) | Implemented |
| Browser workspace, slicing, G-code preview | Implemented |
| Printer agent (Moonraker, OctoPrint, simulator) | Implemented; physical printing not certified |
| Retention cleanup, metrics/alerts, CI/CD, backups | Not implemented |
| AWS deployment | Not implemented |
