# Scripts

Helper scripts for running and checking the self-hosted stack. Run them from the project root.

| Script | Purpose | Needs |
|---|---|---|
| [`start-local.fish`](#start-localfish) | Pull, build and start the stack | Podman, `.ph_env` |
| [`stop-local.fish`](#stop-localfish) | Stop the stack | Podman |
| [`verify-self-hosted.fish`](#verify-self-hostedfish) | Non-destructive health check | Running stack, `curl` |
| [`e2e-self-hosted.py`](#e2e-self-hostedpy) | Authenticated end-to-end test | Running stack, `.ph_venv` |
| [`create-printhub-presentation.py`](#create-printhub-presentationpy) | One-slide PowerPoint overview | `python-pptx` |

## `start-local.fish`

```fish
fish scripts/start-local.fish            # foreground
fish scripts/start-local.fish --detach   # background
```

1. Checks for `podman`, a Compose provider, `Deployments/self-hosted/compose.yml` and `.ph_env`. Exits with a hint if any is missing.
2. Pulls `postgres`, `keycloak`, `seaweedfs` and `caddy` images.
3. Builds the API, slicer and frontend images. The first build downloads OrcaSlicer and takes several minutes.
4. Runs `podman compose up` (with `--detach` if passed). The app is at `http://localhost:8080`.

Steps 2 and 3 show a progress bar. Command output goes to a temporary log, and its last 60 lines are printed only on failure.

## `stop-local.fish`

```fish
fish scripts/stop-local.fish
```

Runs `podman compose down`. Volumes are kept, so database and storage data survive.

## `verify-self-hosted.fish`

```fish
fish scripts/verify-self-hosted.fish
```

Checks a running stack and prints `PASS:` per check. Stops at the first `FAIL:`.

1. All eight containers (`printhub_<service>`) are running.
2. `/health/live` and `/health/ready` respond (ready means PostgreSQL and object storage are reachable).
3. Caddy routes `/api/v1/me` (expects 401 when anonymous) and Keycloak's OpenID configuration.
4. The database is at Alembic revision `006_workspace_printers`. DB name and user come from `.ph_env` (default `printhub`).
5. All eleven required tables exist.
6. The private slicer's `/health` returns `ok`, checked from inside its container.
7. Only Caddy publishes `8080` and PostgreSQL publishes loopback `127.0.0.1:5433`. No other service publishes a host port.
8. Caddy serves the React page.

It sends no print command and does not test login or slicing. Use `e2e-self-hosted.py` for that.

## `e2e-self-hosted.py`

```fish
.ph_venv/bin/python scripts/e2e-self-hosted.py
```

Exercises the real services behind Caddy:

1. Creates two temporary Keycloak users through the admin API.
2. Logs both in through Keycloak's hosted form (authorization code + PKCE), as the frontend does.
3. Checks `/me` returns the logged-in user.
4. Creates printer, process and filament profiles that inherit from Voron/ABS OrcaSlicer presets.
5. Uploads a generated cube STL through a signed SeaweedFS URL and verifies the checksum on read-back.
6. Slices it with OrcaSlicer, then checks the G-code checksum, content and job history.
7. Checks the second user gets 404 on the first user's job, G-code and model.
8. Cancels a slice of a dense sphere mid-run. It expects no G-code, and a following slice must still complete.
9. Registers a simulator printer, pairs `app.printer_agent` as a subprocess, sends a print command and checks the simulator is printing the right file. Then sends `stop`.

Keycloak users are deleted afterwards, even on failure. Their PrintHub rows stay in the database for inspection. No physical printer is contacted. Exits `0` on pass, `1` on failure.

| Variable | Default |
|---|---|
| `PRINTHUB_URL` | `http://localhost:8080` |
| `KEYCLOAK_REALM` | `printhub` |
| `KEYCLOAK_CLIENT_ID` | `printhub-frontend` |
| `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` | From `.ph_env`, else `admin` / `change-me` |
| `E2E_SLICE_TIMEOUT` | `300` seconds |
| `E2E_PRINTER_PARENT` | `Voron Trident 250 0.4 nozzle` |
| `E2E_PROCESS_PARENT` | `0.20mm Standard @Voron` |
| `E2E_FILAMENT_PARENT` | `Generic ABS @System` |

## `create-printhub-presentation.py`

```fish
.ph_venv/bin/python scripts/create-printhub-presentation.py
```

Builds a single 16:9 slide with `python-pptx` and saves it to `Documentation/printcloud-one-page.pptx`. The slide compares the traditional slicing workflow with PrintCloud's and lists two advantages: no local slicer and printing beyond the local network. The output path is relative, so run it from the project root.
