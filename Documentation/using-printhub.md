# Using PrintHub

Start the stack first ([Getting started](getting-started.md)), then sign in at `http://localhost:8080`.

## 1. Import presets

Import an Orca `.orca_printer` or `.zip` bundle (max 25 MB) from the account menu. Each printer, process and filament profile becomes an immutable, versioned record. Re-importing changed settings adds a new version; content identical to the latest version reuses it.

Open a preset's settings button to edit fields or JSON. Saving creates a new version. Older versions can be applied explicitly. Editing a process setting in the sidebar creates a version when you submit the slice.

## 2. Prepare the plate

- **Import:** STL, OBJ, 3MF, AMF or STEP. Drop files on the plate or use Add. STEP loads its OpenCascade reader on first use.
- **Transform:** drag directly, or use Move (`M`), Rotate (`R`), Scale (`S`), Place on Face (`F`). Escape leaves a tool. Shift-click selects several objects.
- **Arrange (`A`):** packs objects from the centre, respecting bounding boxes and bed exclusion zones. Options: selection only, spacing, quarter-turn rotation, Y alignment. Impossible layouts report an error.
- **Plates:** add, rename or remove plates in the plate strip.
- **Tools:** cut, split shells, assemble, mesh boolean, extruded text, measure, support/seam/fuzzy-skin painting, filament painting, per-object Orca settings, extruder assignment, flush-volume matrix.
- **Calibration:** generates simple towers or coupons for temperature, pressure advance, flow, retraction and volumetric speed. Pressure advance and retraction need a Klipper preset. Inspect every generated file before printing.

## 3. Save your work

- **File > Save/Open** uses the `.printhub` project format (lossless for this workspace).
- Drafts autosave per account in the browser's IndexedDB, not on the server. Wait for **Autosaved** before closing the tab.
- Undo/redo covers model edits.

## 4. Slice and preview

Choose Printer, Filament and Process, then **Slice plate** or **Slice all plates**. Hidden objects are skipped. Fix out-of-volume and overlap errors first.

The plate is packaged as 3MF, uploaded straight to object storage through a signed URL, and queued. A worker slices it with OrcaSlicer. Jobs can be cancelled while queued or slicing, and retried after failure or cancellation.

The preview shows the stored G-code: orbit/pan/zoom, camera presets, layer range, single layer, move playback, feature-role visibility, heatmaps and synced G-code text. Changing the plate invalidates its preview. Earlier jobs stay in the Project panel.

## 5. Connect a printer

1. Open **Device** and register a printer. Pick its printer preset and host type: Moonraker, OctoPrint or Simulator.
2. Click **Get pairing code**. The code is single-use and expires after 10 minutes.
3. On a machine on the printer's LAN, run the agent from `Backend`:

```fish
source ../.ph_venv/bin/activate.fish
python -m app.printer_agent --server http://PRINTHUB_HOST:8080 --pair YOUR_CODE --host http://PRINTER_IP:7125
```

| Option | Meaning |
|---|---|
| `--host` | Moonraker or OctoPrint URL (default `http://127.0.0.1:7125`); ignored for Simulator |
| `--camera URL` | Relay a JPEG snapshot (under 900 KB) to the dashboard |
| `--config PATH` | Credential file (default `.ph_agent.json`, mode `0600`; keep it out of Git) |
| `PRINTHUB_HOST_API_KEY` | Environment variable for the OctoPrint API key |

After pairing, restart the agent without `--pair`. Pairing again revokes the previous agent.

## 6. Print

Select a completed job in **Project**, choose **Print**, pick a printer, and confirm. The server only accepts the print if:

- the agent sent a heartbeat in the last 45 seconds and reports `ready`;
- the printer's preset matches the one used to slice;
- no other print is queued or delivered for that printer.

The agent downloads the G-code through a 5-minute signed URL, checks its SHA-256, uploads it to the printer host, checks it again, then starts. **Device** shows progress, temperatures, camera, pause/resume/stop, and idle-only home/jog/extrude. Heat the nozzle with the printer's own controls before extruding.

Use HTTPS before sending tokens over an untrusted network. Never leave a print unattended because PrintHub started it.

## Current limits

- Browser workspace only; not the full desktop Orca GUI. No desktop plugins, parametric CAD or Orca Cloud sync.
- 3MF import keeps geometry and transforms, not every Orca project setting, modifier, texture or paint.
- Collision and exclusion checks use bounding boxes. Curved beds use the profile's rectangular bounds.
- Calibration models are basic. Text uses one bundled typeface. Invalid meshes may fail booleans or slicing.
- Preview time, flow and temperature are parsed estimates.
- Delivered printer commands are not replayed after an agent crash. Check the printer before retrying.
