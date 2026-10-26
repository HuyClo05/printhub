# PrintHub Frontend

React/Vite slicing workspace for self-hosted PrintHub.

It provides:

- Keycloak Authorization Code + PKCE login;
- visible authenticated-user information;
- PostgreSQL/object-storage health status;
- Keycloak logout;
- multi-plate preparation, STL/OBJ/3MF/AMF/STEP imports and manual transforms;
- project save/open, account-specific browser autosave and undo/redo;
- immutable preset editing, per-object settings, painting, geometry tools and calibration models;
- signed uploads, slice cancellation/retry, stored models and job history;
- worker-parsed, orbitable 3D G-code preview with layer/move playback;
- printer-agent pairing, live telemetry, camera snapshots and confirmed print controls.

The Compose build receives its `VITE_OIDC_*` values from the project-level
`.ph_env` file. Do not put secrets in the React bundle.

## Local development

```sh
npm install
npm run dev
```

For the self-hosted stack, start from the repository root:

```fish
fish scripts/start-local.fish --detach
```

The startup script rebuilds the API, frontend and private slicer service, then
applies migration `006_workspace_printers`. Do not delete existing database volumes.

See [Using PrintHub](../Documentation/using-printhub.md) for usage,
tests, agent setup and current limitations. See [scripts/README.md](../scripts/README.md)
for what each stack script does.

## Browser regression checks

With Vite running on port 5174 in another terminal:

```sh
npm ci
npx playwright install chromium
npm run dev -- --port 5174
```

```sh
npm run test:workspace
npm run test:geometry
```

These checks mock application API responses and never start a physical print.
Set `PRINTHUB_TEST_URL` for a different **Vite** URL. Optionally set
`PRINTHUB_STEP_FIXTURE=/absolute/path/model.step` for a real STEP/WASM import check.

To verify production loading boundaries, run `npm run build`, start
`npm run preview`, then run `npm run test:performance` in another terminal.
