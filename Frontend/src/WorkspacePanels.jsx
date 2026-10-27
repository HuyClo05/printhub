import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

export const WorkspaceServices = createContext(null)
export function useServices() { return useContext(WorkspaceServices) }
export async function apiJson(api, path, options) {
  const response = await api(path, options)
  if (!response.ok) {
    let message = response.statusText
    try { const payload = await response.json(); message = typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail || payload) } catch {}
    throw new Error(message)
  }
  return response.status === 204 ? null : response.json()
}
export function useCollection(path, interval = 4000) {
  const { apiFetch } = useServices()
  const api = useRef(apiFetch); api.current = apiFetch
  const [data, setData] = useState([]), [error, setError] = useState('')
  const refreshRef = useRef()
  useEffect(() => {
    let alive = true, busy = false
    async function refresh() {
      if (busy) return
      busy = true
      try { const result = await apiJson(api.current, path); if (alive) { setData(result); setError('') } } catch (e) { if (alive) setError(e.message) } finally { busy = false }
    }
    refreshRef.current = refresh; refresh()
    const timer = setInterval(refresh, interval)
    return () => { alive = false; clearInterval(timer) }
  }, [path, interval])
  return { data, error, refresh: () => refreshRef.current?.() }
}

export function JobsPanel() {
  const services = useServices()
  const { data, error, refresh } = useCollection('/slice-jobs')
  const files = useCollection('/files', 10000)
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [actionError, setActionError] = useState('')
  async function action(job, name) {
    setActionError('')
    try { const result = await apiJson(services.apiFetch, `/slice-jobs/${job.id}/${name}`, { method: 'POST' }); refresh(); if (name === 'retry') services.openJob(result) } catch (e) { setActionError(e.message) }
  }
  const matching = data.filter(job => (filter === 'all' || job.status === filter) && `${job.name} ${job.printer_profile} ${job.id}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="workspace-panel-screen feature-screen"><h2>Projects & jobs</h2><p className="muted">Your stored models, slices and G-code files. Updates refresh automatically.</p>
    <div className="feature-toolbar"><input placeholder="Search jobs, printers or filenames" value={query} onChange={e => setQuery(e.target.value)} /><select value={filter} onChange={e => setFilter(e.target.value)}>{['all', 'queued', 'slicing', 'retrying', 'completed', 'failed', 'dead-lettered', 'cancelled'].map(s => <option key={s}>{s}</option>)}</select><button onClick={refresh}>Refresh</button><button onClick={services.saveProject}>Save project</button><button onClick={services.openProject}>Open project</button></div>
    {(error || actionError) && <p role="alert" className="error">{error || actionError}</p>}
    {!matching.length && <p className="empty-feature">No matching jobs yet. Prepare a model and slice a plate to create your first job.</p>}
    <div className="feature-table"><table><thead><tr><th>Model / created</th><th>Printer / process</th><th>Status</th><th>Result</th><th>Actions</th></tr></thead><tbody>{matching.map(job => <tr key={job.id}><td><strong>{job.name}</strong><small>{new Date(job.created_at).toLocaleString()}</small></td><td>{job.printer_profile}<small>{job.process_profile}</small></td><td><span className={`job-badge ${job.status}`}>{job.status}</span><small>Attempt {job.attempt_count}/{job.max_attempts}</small>{job.error_message && <details><summary>Error details</summary><p className="error">{job.error_message}</p></details>}</td><td>{job.print_time_seconds ? `${Math.round(job.print_time_seconds / 60)} min` : '—'}<small>{job.filament_used_g ? `${job.filament_used_g.toFixed(1)} g` : ''}</small>{job.gcode_sha256 && <details><summary>SHA-256</summary><code>{job.gcode_sha256}</code></details>}</td><td><div className="feature-actions"><button onClick={() => services.openJob(job)}>Open</button>{job.status === 'completed' && <><button onClick={() => services.downloadJob(job)}>G-code</button><button onClick={() => services.printJob(job)}>Print…</button></>}{['failed', 'dead-lettered', 'cancelled'].includes(job.status) && <button onClick={() => action(job, 'retry')}>Retry</button>}{['queued', 'slicing', 'retrying'].includes(job.status) && <button onClick={() => action(job, 'cancel')}>Cancel</button>}</div></td></tr>)}</tbody></table></div>
    <h3>Stored model library</h3>{files.error && <p className="error">{files.error}</p>}<div className="model-library">{files.data.map(file => <button key={file.id} onClick={() => services.importStoredModel(file)}><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Add to plate</span></button>)}</div>
  </div>
}

export function PrinterPanel() {
  const services = useServices()
  const { data, error, refresh } = useCollection('/printers')
  const [form, setForm] = useState({ name: '', model: '', host_type: 'moonraker', profile_name: services.selectedPrinter || '' })
  const [selected, setSelected] = useState(''), [pairing, setPairing] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const [axis, setAxis] = useState('X'), [distance, setDistance] = useState(1)
  const printer = data.find(p => p.id === selected) || data[0]
  const commands = useCollection(printer ? `/printers/${printer.id}/commands` : '/printers')
  const status = printer?.telemetry || {}
  async function run(work) { setBusy(true); setMessage(''); try { await work(); refresh(); commands.refresh() } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
  async function create(e) { e.preventDefault(); run(async () => { const created = await apiJson(services.apiFetch, '/printers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); setSelected(created.id); setForm({ ...form, name: '' }) }) }
  async function command(action) {
    if (['print', 'stop', 'home', 'jog', 'extrude'].includes(action) && !confirm(`${action === 'print' ? 'Start printing the selected G-code' : `Send ${action} command`} on ${printer.name}?`)) return
    await apiJson(services.apiFetch, `/printers/${printer.id}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, job_id: services.job?.id, axis, distance: Number(distance) }) })
    setMessage(`${action} command queued for the printer agent.`)
  }
  return <div className="workspace-panel-screen feature-screen"><h2>Printers</h2><p className="muted">Pair an agent running on your printer network. Printer API credentials remain on that machine.</p>{(error || message) && <p role="status" className={error ? 'error' : 'notice'}>{error || message}</p>}
    <form className="printer-register feature-toolbar" onSubmit={create}><input required placeholder="Printer name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><select value={form.host_type} onChange={e => setForm({ ...form, host_type: e.target.value })}><option value="moonraker">Moonraker / Klipper</option><option value="octoprint">OctoPrint</option><option value="simulator">Simulator</option></select><select required value={form.profile_name} onChange={e => setForm({ ...form, profile_name: e.target.value })}><option value="">Select matching printer preset</option>{services.profiles.printers.map(p => <option key={p}>{p}</option>)}</select><button disabled={busy}>Register printer</button></form>
    <div className="printer-cards">{data.map(p => <button key={p.id} className={p.id === printer?.id ? 'selected' : ''} onClick={() => { setSelected(p.id); setPairing(null) }}><strong>{p.name}</strong><span>{p.host_type} · {p.state}</span><small>{p.profile_name}</small></button>)}</div>
    {printer && <><div className="feature-toolbar"><h3>{printer.name}</h3><span className={`job-badge ${printer.state}`}>{printer.state}</span><button disabled={busy} onClick={() => run(async () => { setPairing(await apiJson(services.apiFetch, `/printers/${printer.id}/pair`, { method: 'POST' })) })}>{printer.paired ? 'Re-pair agent' : 'Get pairing code'}</button><button disabled={busy} onClick={() => { if (confirm(`Remove ${printer.name}?`)) run(() => apiJson(services.apiFetch, `/printers/${printer.id}`, { method: 'DELETE' })) }}>Remove</button></div>
    {pairing && <div className="pairing-instructions"><strong>Run on the machine connected to your printer</strong><pre>python -m app.printer_agent --server {window.location.origin} --pair {pairing.code}{printer.host_type !== 'simulator' ? ' --host http://YOUR-PRINTER-IP' : ''}</pre><p>Run from Backend with the PrintHub Python environment activated. Expires {new Date(pairing.expires_at).toLocaleTimeString()}. For OctoPrint set PRINTHUB_HOST_API_KEY on the agent machine.</p></div>}
    <div className="device-live-grid"><article><h3>Live status</h3><p>Nozzle: {status.nozzle_temperature ?? '—'} °C / {status.nozzle_target ?? '—'} °C</p><p>Bed: {status.bed_temperature ?? '—'} °C / {status.bed_target ?? '—'} °C</p><p>{status.filename || 'No active print'}</p><progress max="1" value={status.progress || 0} /><p>{Math.round((status.progress || 0) * 100)}% · {status.message || printer.state}</p>{status.camera_snapshot && <img className="printer-camera" src={`data:image/jpeg;base64,${status.camera_snapshot}`} alt={`${printer.name} camera`} />}</article><article><h3>Job controls</h3><p>{services.job?.status === 'completed' ? `Selected slice: ${services.job.name || services.job.id}` : 'Open a completed slice from Projects to print.'}</p><div className="feature-actions">{['print', 'pause', 'resume', 'stop'].map(action => <button key={action} disabled={busy || printer.state === 'offline' || (action === 'print' && (services.job?.status !== 'completed' || printer.profile_name !== services.job.printer_profile || printer.state !== 'ready'))} onClick={() => run(() => command(action))}>{action === 'print' ? 'Start print' : action}</button>)}</div><h3>Motion</h3><div className="feature-toolbar"><select value={axis} onChange={e => setAxis(e.target.value)}>{['X', 'Y', 'Z'].map(a => <option key={a}>{a}</option>)}</select><input type="number" min="-50" max="50" value={distance} onChange={e => setDistance(e.target.value)} /> mm</div><div className="feature-actions">{['home', 'jog', 'extrude'].map(action => <button key={action} disabled={busy || printer.state !== 'ready'} onClick={() => run(() => command(action))}>{action}</button>)}</div></article></div>
    <h3>Command delivery</h3><ul className="command-log">{commands.data.filter(c => c.action).map(c => <li key={c.id}>{c.action} · {c.status}{c.error && <span className="error"> · {c.error}</span>}</li>)}</ul></>}
    {!data.length && <p className="empty-feature">Register a printer to get started. Choose Simulator to verify the workflow without hardware.</p>}
  </div>
}

// Parent-chain bookkeeping keys that never belong in a child preset.
const PARENT_ONLY_KEYS = new Set(['name', 'inherits', 'from', 'instantiation', 'setting_id', 'filament_id'])

export function ProfileEditor({ category, name, settings, inherited = {}, saved, onClose, onSaved }) {
  const services = useServices()
  const [draft, setDraft] = useState(() => structuredClone(settings || {})), [search, setSearch] = useState(''), [saveName, setSaveName] = useState(name || ''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const [raw, setRaw] = useState(false), [json, setJson] = useState(JSON.stringify(settings || {}, null, 2)), [note, setNote] = useState('')
  // Compare against the stored preset (not unsaved sidebar overrides); an edit back to the inherited value is not a change.
  const baseline = saved || settings || {}
  const isUnsaved = key => key in draft && JSON.stringify(draft[key]) !== JSON.stringify(baseline[key] ?? inherited[key])
  const unsavedCount = raw ? 0 : Object.keys(draft).filter(isUnsaved).length
  async function save() {
    setSaving(true); setError('')
    try {
      const settings = raw ? JSON.parse(json) : draft
      const version = await apiJson(services.apiFetch, '/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, name: saveName, settings: { ...settings, name: saveName }, note: note.trim() || null }) })
      await onSaved(category, saveName, settings, version.id); onClose()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="settings-dialog real-profile-editor" role="dialog" aria-modal="true" aria-label={`${category} preset editor`}><header className="settings-dialog-header"><h2>Edit {category === 'presets' ? 'process' : category === 'printers' ? 'printer' : 'filament'} preset</h2><button onClick={onClose} aria-label="Close">×</button></header><div className="feature-toolbar"><input value={saveName} onChange={e => setSaveName(e.target.value)} aria-label="Preset name" /><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Version note (optional)" aria-label="Version note" /><button onClick={() => { if (!raw) setJson(JSON.stringify(draft, null, 2)); else { try { setDraft(JSON.parse(json)) } catch (e) { setError(e.message); return } } setRaw(!raw) }}>{raw ? 'Fields' : 'JSON'}</button></div><p className="muted">Saving creates a new version. Change the name to duplicate this preset. Use the history button to compare or restore versions.</p>{error && <p className="error" role="alert">{error}</p>}<input type="search" placeholder="Search setting names" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="profile-editor-fields">{raw ? <textarea value={json} onChange={e => setJson(e.target.value)} aria-label="Preset JSON" /> : [...Object.entries(draft), ...Object.entries(inherited).filter(([key]) => !(key in draft) && !PARENT_ONLY_KEYS.has(key))].filter(([key]) => key.toLowerCase().includes(search.toLowerCase())).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => <label className={`editable-setting${key in draft ? '' : ' inherited'}${isUnsaved(key) ? ' unsaved' : ''}`} key={key} title={key in draft ? undefined : 'Inherited from parent preset'}><span>{key.replaceAll('_', ' ')}</span>{typeof value === 'object' ? <input value={JSON.stringify(value)} onChange={e => { try { setDraft({ ...draft, [key]: JSON.parse(e.target.value) }); setError('') } catch { setError(`Use valid JSON for ${key}, or edit this field in JSON mode.`) } }} /> : <input value={String(value ?? '')} onChange={e => setDraft({ ...draft, [key]: typeof value === 'number' ? Number(e.target.value) : typeof value === 'boolean' ? e.target.value === 'true' : e.target.value })} />}</label>)}</div><footer className="settings-dialog-footer"><button onClick={onClose}>Cancel</button><button onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save new version & apply${unsavedCount ? ` (${unsavedCount} change${unsavedCount === 1 ? '' : 's'})` : ''}`}</button></footer></section></div>
}

function settingDisplay(value) {
  if (value === undefined) return '—'
  return Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
}

export function PresetHistory({ category, name, currentVersionId, confirmMessage, onClose, onRestored }) {
  const services = useServices()
  const versions = useCollection(`/profiles?category=${category}&name=${encodeURIComponent(name)}`, 15000)
  const [selected, setSelected] = useState([]), [diff, setDiff] = useState(null), [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const cache = useRef(new Map())
  const rows = versions.data
  const current = currentVersionId || rows[0]?.id
  async function settingsOf(id) {
    if (!cache.current.has(id)) cache.current.set(id, (await apiJson(services.apiFetch, `/profiles/${id}`)).settings)
    return cache.current.get(id)
  }
  useEffect(() => {
    setDiff(null)
    if (selected.length !== 2) return
    let alive = true
    // Always show older → newer, whichever order the versions were picked in.
    const [older, newer] = selected.map(id => rows.find(v => v.id === id)).sort((a, b) => a.version - b.version)
    Promise.all([settingsOf(older.id), settingsOf(newer.id)]).then(([before, after]) => {
      if (!alive) return
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort()
      setDiff({ older, newer, changes: keys.map(key => [key, before[key], after[key]]) })
    }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [selected.join()])
  function toggle(id) { setSelected(current => current.includes(id) ? current.filter(v => v !== id) : [...current, id].slice(-2)) }
  const restoreTarget = selected.length === 1 ? rows.find(v => v.id === selected[0]) : null
  async function restore() {
    if (confirmMessage && !confirm(confirmMessage)) return
    setBusy(true); setError('')
    try {
      const version = await apiJson(services.apiFetch, `/profiles/${restoreTarget.id}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note.trim() || null }) })
      await onRestored(category, name, await settingsOf(restoreTarget.id), version.id)
      setSelected([]); setNote(''); versions.refresh()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="settings-dialog preset-history" role="dialog" aria-modal="true" aria-label={`${name} version history`}>
    <header className="settings-dialog-header"><h2>History · {name}</h2><button onClick={onClose} aria-label="Close">×</button></header>
    <p className="muted">Select one version to restore it, or two to compare them. Restoring adds a new version; history is never deleted.</p>
    {(error || versions.error) && <p className="error" role="alert">{error || versions.error}</p>}
    <div className="preset-history-body">
      <ul className="preset-history-list">{rows.map(v => <li key={v.id}><label className={selected.includes(v.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} /><strong>v{v.version}</strong>{v.id === current && <span className="version-badge">current</span>}<span className="muted">{new Date(v.created_at).toLocaleString()} · {services.displayName || 'You'}</span>{v.note && <em>{v.note}</em>}</label></li>)}{!rows.length && <li className="muted">No versions yet.</li>}</ul>
      {diff && <div className="preset-history-diff"><h3>v{diff.older.version} → v{diff.newer.version} · {diff.changes.length} changed</h3>{diff.changes.length ? <table><thead><tr><th>Setting</th><th>v{diff.older.version}</th><th>v{diff.newer.version}</th></tr></thead><tbody>{diff.changes.map(([key, before, after]) => <tr key={key}><td>{key.replaceAll('_', ' ')}</td><td className="diff-old">{settingDisplay(before)}</td><td className="diff-new">{settingDisplay(after)}</td></tr>)}</tbody></table> : <p className="muted">These versions have identical settings.</p>}</div>}
    </div>
    <footer className="settings-dialog-footer">{restoreTarget && <><input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder={`Note (default: Restored from v${restoreTarget.version})`} aria-label="Restore note" /><button onClick={restore} disabled={busy}>{busy ? 'Restoring…' : `Restore v${restoreTarget.version}`}</button></>}<button className="secondary" onClick={onClose}>Close</button></footer>
  </section></div>
}
