import React, { useState } from 'react'
import { useServices } from './WorkspacePanels.jsx'

export function AdvancedTools({ action, models, selectedIds, onAction, onClose, onUpdateModel }) {
  const [tool, setTool] = useState(action), [busy, setBusy] = useState(false)
  const model = models.find(m => m.id === selectedIds[0])
  const [options, setOptions] = useState({ axis: 'z', at: model?.position.z || 5, operation: 'union', text: 'PrintHub', size: 10, depth: 2, min: 0, max: model?.dimensions.z || 10, height: .12, extruder: 1 })
  const [json, setJson] = useState(JSON.stringify(model?.settings || {}, null, 2)), [error, setError] = useState('')
  const names = { cut: 'Cut model', split: 'Split disconnected objects', 'split-parts': 'Split to assembly parts', meshboolean: 'Mesh boolean', layers: 'Variable layer height', text: 'Text / emboss', assembly: 'Assemble selected models', mmu: 'Assign extruder', 'object-settings': 'Object print settings', menu: 'Model tools' }
  async function apply() {
    setBusy(true); setError('')
    try {
      if (tool === 'object-settings') { const settings = JSON.parse(json); if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Enter a JSON object'); selectedIds.forEach(id => onUpdateModel(id, { settings })) }
      else await onAction(tool, options)
      onClose()
    } catch(e) { setError(e.message) } finally { setBusy(false) }
  }
  const field = (key, label, type = 'number') => <label className="editable-setting"><span>{label}</span><input type={type} value={options[key]} step={key === 'height' ? .01 : 'any'} onChange={e => setOptions({ ...options, [key]: e.target.value })} /></label>
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="settings-dialog model-tool-dialog" role="dialog" aria-modal="true" aria-label={names[tool]}><header className="settings-dialog-header"><h2>{names[tool]}</h2><button onClick={onClose}>×</button></header>
    {tool === 'menu' ? <div className="tool-menu-grid">{Object.entries(names).filter(([key]) => key !== 'menu').map(([key, name]) => <button key={key} onClick={() => setTool(key)}>{name}</button>)}</div> : <><p className="muted">{selectedIds.length} selected object(s). Use Undo to reverse a geometry change.</p>{error && <p className="error">{error}</p>}
    {tool === 'cut' && <><label>Axis<select value={options.axis} onChange={e => setOptions({ ...options, axis: e.target.value })}>{['x', 'y', 'z'].map(k => <option key={k}>{k}</option>)}</select></label>{field('at', 'Cut coordinate (world mm)')}<p>Both halves are capped and kept as separate objects. Arrange them before slicing.</p></>}
    {tool === 'meshboolean' && <><label>Operation<select value={options.operation} onChange={e => setOptions({ ...options, operation: e.target.value })}>{['union', 'subtract', 'intersect'].map(k => <option key={k}>{k}</option>)}</select></label><p>Select two watertight models. For subtraction the first selected model is the base.</p></>}
    {tool === 'text' && <>{field('text', 'Text', 'text')}{field('size', 'Font size (mm)')}{field('depth', 'Depth (mm)')}<p>The text becomes real geometry. Position it, then use boolean union/subtraction to emboss or engrave.</p></>}
    {tool === 'layers' && <>{field('min', 'Start Z (mm)')}{field('max', 'End Z (mm)')}{field('height', 'Layer height (mm)')}<p>Ranges are exported as native Orca 3MF object settings.</p>{model?.layerRanges?.map((r, i) => <p key={i}>{r.min}–{r.max} mm: {r.settings.layer_height} mm layers</p>)}</>}
    {tool === 'mmu' && <>{field('extruder', 'Extruder / filament slot (1-based)')}<p>Requires a printer configured with the corresponding extruder and filament slots.</p></>}
    {tool === 'object-settings' && <><p>Orca setting keys, e.g. layer_height, wall_loops, sparse_infill_density. These apply only to selected objects.</p><textarea className="object-settings-json" value={json} onChange={e => setJson(e.target.value)} /></>}
    {['split', 'split-parts', 'assembly'].includes(tool) && <p>{tool === 'assembly' ? 'Merge selected models at their current positions into one assembly.' : 'Separate disconnected shells in the selected mesh. Each shell becomes a selectable part.'}</p>}
    <footer className="settings-dialog-footer"><button onClick={onClose}>Cancel</button><button onClick={apply} disabled={busy}>{busy ? 'Processing…' : 'Apply'}</button></footer></>}
  </section></div>
}

export function CalibrationTools() {
  const { generateCalibration } = useServices()
  const [kind, setKind] = useState('Temperature'), [range, setRange] = useState({ start: 190, end: 230, step: 5 })
  const defaults = { Temperature: [190, 230, 5], 'Pressure Advance': [0, .08, .01], 'Flow Ratio': [.9, 1.1, .025], Retraction: [.2, 1.8, .2], 'Volumetric Speed': [5, 25, 2], Tolerance: [-.2, .2, .05] }
  return <div className="workspace-panel-screen feature-screen"><h2>Calibration</h2><p>Generate a test model, slice it with your printer preset, and inspect the result before saving a new preset version.</p><div className="calibration-options"><label>Test<select value={kind} onChange={e => { setKind(e.target.value); const [start, end, step] = defaults[e.target.value]; setRange({ start, end, step }) }}>{Object.keys(defaults).map(k => <option key={k}>{k}</option>)}</select></label>{['start', 'end', 'step'].map(k => <label key={k}>{k}<input type="number" step="any" value={range[k]} onChange={e => setRange({ ...range, [k]: e.target.value })} /></label>)}<button onClick={() => generateCalibration(kind, range)}>Generate test on current plate</button></div><p className="muted">Each band is 5 mm high. Pressure advance and retraction commands use Klipper syntax; use these tests with Klipper presets. Temperature and flow tests use standard M104 / M221 commands. Volumetric speed and tolerance generate separate test coupons with per-object settings.</p></div>
}
