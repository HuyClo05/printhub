import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createToolpathScene } from './threeToolpaths.js'

const VIEW_TYPES = ['Line Type', 'Filament', 'Speed', 'Acceleration', 'Jerk', 'Layer Height', 'Line Width', 'Flow', 'Layer Time', 'Layer Time (logarithmic)', 'Fan Speed', 'Temperature', 'Pressure Advance', 'Color Print']
const ROLE_COLORS = ['#46c7bb', '#ee8d9a', '#e4b34e', '#8ba8ff', '#c18ee8', '#f1d86a', '#e7835b', '#8bd2c8', '#ff9f5d', '#a6b5d9', '#d891d1', '#f09f50', '#6da6ed', '#9e8ce8', '#81c2e5', '#c9d45e', '#c2c6d4', '#747c91']
const FILAMENT_COLORS = ['#36c6b6', '#ed7d91', '#e8bd5c', '#78a8f5', '#c38ee9', '#e6d86a', '#f1a15c', '#9ed4cc']
const MOVE_COLORS = { travel: '#717b90', wipe: '#d69c58', retract: '#dc6f7b', deretract: '#70c7bd', marker: '#f0d15b' }
const RANGE_COLORS = ['#3155cf', '#27b9e5', '#36c979', '#e6d942', '#ee8e35', '#d94747']
const rangeCache = new WeakMap()

export default function GCodeViewer({ gcode, job, onDownload, plate, models = [] }) {
  const canvasRef = useRef(null)
  const workerRef = useRef(null)
  const sceneRef = useRef(null)
  const [perspective, setPerspective] = useState(true)
  const [parsed, setParsed] = useState(null)
  const [parseProgress, setParseProgress] = useState(0)
  const [parseError, setParseError] = useState('')
  const [layerLow, setLayerLow] = useState(0)
  const [layerHigh, setLayerHigh] = useState(0)
  const [moveIndex, setMoveIndex] = useState(0)
  const [viewType, setViewType] = useState('Line Type')
  const [collapsed, setCollapsed] = useState(false)
  const [showGcode, setShowGcode] = useState(false)
  const [oneLayer, setOneLayerState] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [cameraMode, setCameraMode] = useState('Default')
  const [options, setOptions] = useState({ travel: true, wipe: true, retract: true, deretract: true, seams: true, tool: true, color: true, pause: true, custom: true, shells: true, toolpaths: true, dimLower: true })
  const [roleVisibility, setRoleVisibility] = useState({})
  const [webglAvailable, setWebglAvailable] = useState(false)

  function setOneLayer(value) {
    setOneLayerState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      setLayerLow(next ? layerHigh : 0)
      return next
    })
  }

  useEffect(() => {
    setParsed(null); setParseProgress(0); setParseError(''); setPlaying(false)
    const worker = new Worker(new URL('./gcodeWorker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event) => {
      const result = event.data
      if (result.type === 'progress') return setParseProgress(result.value)
      if (result.type === 'cancelled') return
      if (result.type === 'error') return setParseError(result.message)
      if (result.type === 'complete') {
        setParsed(result)
        setLayerLow(0)
        setLayerHigh(Math.max(0, result.layers.length - 1))
        setMoveIndex(Math.max(0, result.moves.line.length - 1))
        setRoleVisibility(Object.fromEntries(result.roles.map((role) => [role, true])))
        setParseProgress(1)
      }
    }
    worker.onerror = (event) => setParseError(event.message || 'The G-code parser failed.')
    worker.postMessage({ type: 'parse', source: gcode })
    return () => { worker.postMessage({ type: 'cancel' }); worker.terminate(); workerRef.current = null }
  }, [gcode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !parsed) return
    try {
      sceneRef.current = createToolpathScene(canvas, parsed, plate, colorForMove)
      setWebglAvailable(true)
    } catch (error) { setParseError(`3D preview could not start: ${error.message}`) }
    return () => { sceneRef.current?.dispose(); sceneRef.current = null }
  }, [parsed, plate])

  useEffect(() => {
    sceneRef.current?.update({ layerLow, layerHigh, moveIndex, viewType, options, roleVisibility, models })
  }, [parsed, plate, models, layerLow, layerHigh, moveIndex, viewType, options, roleVisibility, cameraMode])

  useEffect(() => { sceneRef.current?.setView(cameraMode) }, [cameraMode, parsed])
  useEffect(() => { sceneRef.current?.setPerspective(perspective) }, [perspective, parsed])

  useEffect(() => {
    if (!playing || !parsed) return undefined
    const timer = window.setInterval(() => {
      setMoveIndex((current) => {
        const last = layerMoveRange(parsed, layerLow, layerHigh)[1]
        if (current >= last) { setPlaying(false); return last }
        return current + Math.max(1, Math.round(speed))
      })
    }, 40)
    return () => window.clearInterval(timer)
  }, [playing, parsed, layerLow, layerHigh, speed])

  const moveRange = parsed ? layerMoveRange(parsed, layerLow, layerHigh) : [0, 0]
  const activeLine = parsed?.moves?.line?.[moveIndex] || 0
  const layerInfo = parsed?.layers?.[oneLayer ? layerHigh : layerHigh]
  const visibleRoles = parsed?.roleStats?.filter((entry) => entry.moves > 0) || []
  const sourceLines = useMemo(() => String(gcode || '').split(/\r?\n/), [gcode])
  const printTime = parsed ? formatTime(parsed.footer.totalTime || parsed.footer.timeSeconds || 0) : '—'
  const layerEvents = useMemo(() => parsed ? Array.from(parsed.moves.type).flatMap((type, i) => type === 7 || type === 8 ? [{ layer: parsed.moves.layer[i], label: type === 7 ? 'Color change' : 'Pause print' }] : []) : [], [parsed])

  function updateLayerHigh(value) {
    const next = Math.max(layerLow, Math.min(Number(value), Math.max(0, (parsed?.layers?.length || 1) - 1)))
    setLayerHigh(next)
    if (oneLayer) setLayerLow(next)
    setMoveIndex(clampMove(parsed, layerLow, next, moveIndex))
  }

  function updateLayerLow(value) {
    const next = Math.min(layerHigh, Math.max(0, Number(value)))
    setLayerLow(next)
    if (oneLayer) setLayerHigh(next)
    setMoveIndex(clampMove(parsed, next, layerHigh, moveIndex))
  }

  function toggleOneLayer() {
    setOneLayer((current) => {
      const next = !current
      setLayerLow(next ? layerHigh : 0)
      return next
    })
  }

  function jumpToLine(lineNumber) {
    if (!parsed) return
    const lines = parsed.moves.line
    let low = 0; let high = lines.length - 1; let result = 0
    while (low <= high) { const middle = (low + high) >> 1; if (lines[middle] <= lineNumber) { result = middle; low = middle + 1 } else high = middle - 1 }
    setMoveIndex(result)
    const targetLayer = parsed.moves.layer[result] || 0
    setLayerHigh(targetLayer); if (oneLayer) setLayerLow(targetLayer)
  }

  function handleCanvasKeyDown(event) {
    if (!parsed) return
    if (event.key === ' ') {
      event.preventDefault()
      setPlaying((current) => !current)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setMoveIndex((current) => clampMove(parsed, layerLow, layerHigh, current + delta))
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = event.key === 'ArrowUp' ? 1 : -1
      const next = Math.max(0, Math.min(parsed.layers.length - 1, layerHigh + delta))
      updateLayerHigh(next)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setMoveIndex(moveRange[0])
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setMoveIndex(moveRange[1])
      return
    }
    if (event.key.toLowerCase() === 'c') {
      setShowGcode((current) => !current)
      return
    }
    if (event.key.toLowerCase() === 'l') {
      toggleOneLayer()
      return
    }
    if (event.key.toLowerCase() === 'g' && event.shiftKey) {
      const line = window.prompt('Jump to G-code line', String(activeLine || 1))
      if (line) jumpToLine(Number(line))
    }
  }

  if (parseError) return <section className="gcode-card orca-gcode-card"><div className="preview-error"><strong>Could not parse G-code</strong><span>{parseError}</span></div></section>
  if (!parsed) return <section className="gcode-card orca-gcode-card"><div className="gcode-loading"><span className="loading-spinner" /><strong>Parsing G-code…</strong><span>{Math.round(parseProgress * 100)}% · parsing off the UI thread</span><progress value={parseProgress} max="1" /></div></section>

  return <section className="gcode-card orca-gcode-card">
    <header className="gcode-heading"><div><p className="eyebrow">Preview</p><h2>G-code preview</h2><p className="muted">{parsed.layers.length} layers · {parsed.lineCount.toLocaleString()} source lines · {webglAvailable ? '3D extrusion preview' : 'Starting 3D preview…'}</p></div><div className="gcode-heading-actions"><span className="preview-meta">{formatTime(parsed.footer.totalTime || 0)} · {formatWeight(parsed.footer.filamentWeight)}</span>{onDownload && <button type="button" className="small" onClick={onDownload}>Export G-code</button>}</div></header>
    <div className="preview-warning"><strong>Before printing:</strong> verify first-layer contact, unsupported areas, and floating regions.</div>
    <div className="orca-preview-layout">
      <div className="preview-stage-shell">
        <div className="preview-stage-toolbar"><button type="button" className="icon-button" title="Fit to plate" aria-label="Fit to plate" onClick={() => { setCameraMode('Default'); sceneRef.current?.setView('Default') }}>⌖</button><CompactSelect value={cameraMode} options={['Default', 'Top', 'Bottom', 'Front', 'Behind', 'Left', 'Right', 'Current plate']} onChange={setCameraMode} ariaLabel="Camera preset" /><button type="button" className="icon-button" title="Toggle perspective" aria-label="Toggle perspective" aria-pressed={perspective} onClick={() => setPerspective(v => !v)}>◇</button><span className="preview-render-mode">{webglAvailable ? 'WebGL2' : 'Lines'}</span></div>
        <div className="preview-canvas-shell"><canvas ref={canvasRef} tabIndex="0" aria-label="G-code toolpath preview. Use arrow keys to move through layers and toolpath moves." onKeyDown={handleCanvasKeyDown} onClick={(event) => (() => { const index = sceneRef.current?.pick(event); if (index !== null && index !== undefined) setMoveIndex(index) })()} /><div className="preview-axis"><span className="axis-z">Z</span><span className="axis-x">X</span><span className="axis-y">Y</span></div><div className="layer-slider-panel"><div className="layer-slider-label"><strong>{layerInfo?.index !== undefined ? `Layer ${layerInfo.index + 1}` : 'Layer —'}</strong><span>Z {formatNumber(layerInfo?.z, 2)} mm</span></div><div className="dual-layer-slider"><input type="range" min="0" max={Math.max(0, parsed.layers.length - 1)} value={layerLow} onChange={(event) => updateLayerLow(event.target.value)} aria-label="Lower visible layer" /><input type="range" min="0" max={Math.max(0, parsed.layers.length - 1)} value={layerHigh} onChange={(event) => updateLayerHigh(event.target.value)} aria-label="Upper visible layer" /></div><div className="layer-ticks">{layerEvents.map((event, i) => <i key={i} style={{ bottom: `${event.layer / Math.max(1, parsed.layers.length - 1) * 100}%` }} title={`${event.label} · layer ${event.layer + 1}`} />)}</div></div><div className="preview-tool-readout">{formatToolReadout(parsed, moveIndex)}</div>{showGcode && <GCodeWindow sourceLines={sourceLines} activeLine={activeLine} onLineClick={jumpToLine} />}</div>
        <div className="move-slider-bar"><button type="button" className="play-button" title="Play/Pause (Space)" aria-label="Play/Pause" onClick={() => setPlaying((current) => !current)}>{playing ? 'Ⅱ' : '▶'}</button><button type="button" className="secondary small" onClick={() => setMoveIndex(moveRange[0])}>Home</button><input type="range" min={moveRange[0]} max={Math.max(0, moveRange[1])} value={Math.min(Math.max(moveIndex, moveRange[0]), moveRange[1])} onChange={(event) => setMoveIndex(Number(event.target.value))} aria-label="Tool position" /><button type="button" className="secondary small" onClick={() => setMoveIndex(moveRange[1])}>End</button><CompactSelect value={speed} options={[1, 2, 5, 10].map((value) => ({ value, label: `${value}×` }))} onChange={(value) => setSpeed(Number(value))} ariaLabel="Playback speed" /><span>Move {Math.max(0, moveIndex - moveRange[0])} · Line {activeLine || '—'} · {formatTime(parsed.moves.cumulative[moveIndex] || 0)}</span></div>
      </div>
      <aside className={`preview-sidebar${collapsed ? ' collapsed' : ''}`}><div className="preview-sidebar-header"><CompactSelect value={viewType} options={VIEW_TYPES} onChange={setViewType} ariaLabel="Color scheme" /><button type="button" className="icon-button" title={showGcode ? 'Hide G-code window' : 'Show G-code window'} aria-label={showGcode ? 'Hide G-code window' : 'Show G-code window'} onClick={() => setShowGcode((current) => !current)}>&lt;/&gt;</button><button type="button" className="icon-button" title={collapsed ? 'Expand legend' : 'Collapse legend'} aria-label={collapsed ? 'Expand legend' : 'Collapse legend'} onClick={() => setCollapsed((current) => !current)}>{collapsed ? '›' : '‹'}</button></div>{!collapsed && <div className="preview-sidebar-scroll">{viewType === 'Line Type' || viewType === 'Filament' || viewType === 'Color Print' ? <LegendTable entries={visibleRoles} roles={parsed.roles} roleVisibility={roleVisibility} setRoleVisibility={setRoleVisibility} viewType={viewType} /> : <RangeLegend moves={parsed.moves} viewType={viewType} /> }<section className="preview-options"><button type="button" className="preview-section-title">Show options <span>⌄</span></button>{Object.entries(options).map(([key, checked]) => key !== 'dimLower' && <label key={key}><input type="checkbox" checked={checked} onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))} /><span className={`option-marker marker-${key}`} />{optionLabel(key)}</label>)}<label><input type="checkbox" checked={options.dimLower} onChange={(event) => setOptions((current) => ({ ...current, dimLower: event.target.checked }))} />Dim lower layers</label><label><input type="checkbox" checked={oneLayer} onChange={(event) => setOneLayer(event.target.checked)} />One-layer mode (L)</label></section><StatisticsBlock parsed={parsed} job={job} /></div>}</aside>
    </div>
  </section>
}

function CompactSelect({ value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function close(event) { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  const normalized = options.map((option) => typeof option === 'object' ? option : { value: option, label: option })
  const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0]
  return <div className="compact-select" ref={ref}><button type="button" className="compact-select-button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected?.label ?? value}</span><span className="compact-select-arrow">⌄</span></button>{open && <div className="compact-select-menu" role="listbox">{normalized.map((option) => <button type="button" role="option" aria-selected={String(option.value) === String(value)} key={String(option.value)} onClick={() => { onChange(option.value); setOpen(false) }}>{option.label}</button>)}</div>}</div>
}

function LegendTable({ entries, roles, roleVisibility, setRoleVisibility, viewType }) {
  return <section className="preview-legend-section"><div className="preview-section-title"><span>Line Type</span><span>Time · Usage</span></div>{entries.map((entry) => { const role = roles.indexOf(entry.name); const checked = roleVisibility[entry.name] !== false; return <div className={`preview-legend-row${checked ? '' : ' hidden'}`} key={entry.name}><button type="button" className="legend-eye" title={checked ? `Hide ${entry.name}` : `Show ${entry.name}`} aria-label={checked ? `Hide ${entry.name}` : `Show ${entry.name}`} onClick={() => setRoleVisibility((current) => ({ ...current, [entry.name]: !checked }))}>{checked ? '◉' : '⊘'}</button><i className="legend-color" style={{ background: viewType === 'Filament' ? FILAMENT_COLORS[role % FILAMENT_COLORS.length] : ROLE_COLORS[role % ROLE_COLORS.length] }} /><span className="legend-name">{entry.name}</span><span className="legend-time">{formatTime(entry.time)}<small>{formatLength(entry.length)} · {formatWeight(entry.weight)}</small></span></div>})}<div className="legend-total"><strong>Total</strong><span>{formatTime(entries.reduce((sum, entry) => sum + entry.time, 0))}</span></div></section>
}

function RangeLegend({ moves, viewType }) {
  const { min, max, unit, value } = rangeForView(moves, viewType)
  return <section className="range-legend"><div className="preview-section-title"><span>{viewType}</span><span>{formatNumber(min, 1)} – {formatNumber(max, 1)} {unit}</span></div><div className="gradient-bar" />{[0, .2, .4, .6, .8, 1].map((tick) => <span className="gradient-tick" style={{ left: `${tick * 100}%` }} key={tick}>{formatNumber(min + (max - min) * tick, 1)}</span>)}<p className="range-description">{value} {unit} range · travel moves remain in the travel color.</p></section>
}

function StatisticsBlock({ parsed, job }) {
  const totalWeight = parsed.footer.filamentWeight || parsed.roleStats.reduce((sum, entry) => sum + entry.weight, 0)
  const maxLayerTime = parsed.layers.reduce((max, layer) => Math.max(max, layer.time), 1)
  return <section className="preview-statistics"><div className="preview-section-title"><span>Statistics</span><span>⌄</span></div><dl><div><dt>Estimated time</dt><dd>{formatTime(parsed.footer.totalTime || parsed.footer.timeSeconds || 0)}</dd></div><div><dt>Prepare time</dt><dd>—</dd></div><div><dt>Filament</dt><dd>{formatWeight(totalWeight)} · {job?.filament_used_g ? `${formatNumber(job.filament_used_g, 1)} g reported` : 'estimated'}</dd></div><div><dt>Layers</dt><dd>{parsed.layers.length}</dd></div></dl><div className="layer-time-chart">{parsed.layers.slice(0, 28).map((layer) => <i key={layer.index} title={`Layer ${layer.index + 1}: ${formatTime(layer.time)}`} style={{ height: `${Math.max(4, Math.min(100, layer.time / maxLayerTime * 100))}%` }} />)}</div></section>
}

function GCodeWindow({ sourceLines, activeLine, onLineClick }) {
  const start = Math.max(1, activeLine - 10)
  const rows = sourceLines.slice(start - 1, start + 22)
  return <div className="preview-gcode-window"><div className="gcode-window-header"><strong>G-code</strong><span>Line {activeLine || '—'}</span><button type="button" className="icon-button" title="Copy visible G-code" onClick={() => navigator.clipboard?.writeText(rows.join('\n'))}>⧉</button></div><pre>{rows.map((line, index) => { const number = start + index; return <button type="button" className={number === activeLine ? 'active' : ''} key={`${number}-${line}`} onClick={() => onLineClick(number)}><b>{number}</b><code>{colorizeGcode(line)}</code></button> })}</pre></div>
}

function colorizeGcode(line) {
  const commentIndex = line.indexOf(';')
  const command = commentIndex >= 0 ? line.slice(0, commentIndex) : line
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : ''
  return <>{command}<em>{comment}</em></>
}

function optionLabel(key) {
  return { travel: 'Travel', wipe: 'Wipe', retract: 'Retractions', deretract: 'Deretractions', seams: 'Seams', tool: 'Tool changes', color: 'Color changes', pause: 'Pause prints', custom: 'Custom G-codes', shells: 'Shells', toolpaths: 'Toolpaths' }[key] || key
}

function layerMoveRange(parsed, low, high) {
  const layers = parsed.moves.layer
  let first = 0; let last = Math.max(0, layers.length - 1)
  while (first < layers.length && layers[first] < low) first += 1
  while (last >= 0 && layers[last] > high) last -= 1
  return [first, Math.max(first, last)]
}

function clampMove(parsed, low, high, value) {
  if (!parsed) return value
  const [first, last] = layerMoveRange(parsed, low, high)
  return Math.min(last, Math.max(first, value))
}

function formatToolReadout(parsed, index) {
  if (!parsed?.moves?.line?.length) return 'No toolpath selected'
  const move = parsed.moves
  const role = parsed.roles[move.role[index]] || 'Travel'
  return `${role} · ${formatNumber(move.speed[index], 0)} mm/s · ${formatTime(move.cumulative[index])} · ${formatNumber(move.x2[index], 1)}, ${formatNumber(move.y2[index], 1)}, ${formatNumber(move.z[index], 2)} mm`
}

function rangeForView(moves, viewType) {
  let cache = rangeCache.get(moves)
  if (!cache) { cache = new Map(); rangeCache.set(moves, cache) }
  if (cache.has(viewType)) return cache.get(viewType)
  const values = { Speed: moves.speed, 'Actual Speed': moves.speed, Acceleration: moves.acceleration, Jerk: moves.jerk, 'Layer Height': moves.height, 'Line Width': moves.width, Flow: moves.flow, 'Actual Flow': moves.flow, 'Layer Time': moves.layerTime, 'Layer Time (logarithmic)': moves.layerTime, 'Fan Speed': moves.fan, Temperature: moves.temperature, 'Pressure Advance': moves.pressure }[viewType] || moves.speed
  let min = 0; let max = 1; let sum = 0; let count = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value) || value < 0) continue
    if (count === 0) min = value
    else min = Math.min(min, value)
    max = Math.max(max, value)
    sum += value
    count += 1
  }
  const unit = viewType.includes('Speed') ? 'mm/s' : viewType.includes('Flow') ? 'mm³/s' : viewType.includes('Temperature') ? '°C' : viewType.includes('Fan') ? '%' : viewType.includes('Layer Time') ? 's' : viewType.includes('Advance') ? 'mm' : viewType === 'Acceleration' || viewType === 'Jerk' ? 'mm/s²' : 'mm'
  const result = { min, max, unit, value: count ? formatNumber(sum / count, 1) : '0' }
  cache.set(viewType, result)
  return result
}


function colorForMove(parsed, moves, index, viewType) {
  const type = moveTypeName(moves.type[index]); if (type !== 'extrude') return MOVE_COLORS[type] || MOVE_COLORS.travel
  if (viewType === 'Line Type') return ROLE_COLORS[moves.role[index] % ROLE_COLORS.length]
  if (viewType === 'Filament' || viewType === 'Color Print') return FILAMENT_COLORS[moves.tool[index] % FILAMENT_COLORS.length]
  const range = rangeForView(moves, viewType); const values = { Speed: moves.speed, 'Actual Speed': moves.speed, Acceleration: moves.acceleration, Jerk: moves.jerk, 'Layer Height': moves.height, 'Line Width': moves.width, Flow: moves.flow, 'Actual Flow': moves.flow, 'Layer Time': moves.layerTime, 'Layer Time (logarithmic)': moves.layerTime, 'Fan Speed': moves.fan, Temperature: moves.temperature, 'Pressure Advance': moves.pressure }; const value = values[viewType]?.[index] || 0; const ratio = Math.max(0, Math.min(1, (value - range.min) / Math.max(range.max - range.min, .001))); return gradientColor(ratio)
}

function moveTypeName(type) { return ['extrude', 'travel', 'wipe', 'retract', 'deretract', 'seam', 'tool', 'color', 'pause', 'custom'][type] || 'travel' }
function moveIsVisible(type, roleName, state) {
  return state.roleVisibility[roleName] !== false
    && (type !== 'travel' || state.options.travel)
    && (type !== 'wipe' || state.options.wipe)
    && (type !== 'retract' || state.options.retract)
    && (type !== 'deretract' || state.options.deretract)
    && (type !== 'tool' || state.options.tool)
    && (type !== 'color' || state.options.color)
    && (type !== 'pause' || state.options.pause)
    && (type !== 'custom' || state.options.custom)
}
function gradientColor(ratio) { const index = Math.min(RANGE_COLORS.length - 2, Math.floor(ratio * (RANGE_COLORS.length - 1))); const local = ratio * (RANGE_COLORS.length - 1) - index; return mixColor(RANGE_COLORS[index], RANGE_COLORS[index + 1], local) }
function mixColor(first, second, ratio) { const a = first.match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16)); const b = second.match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16)); return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * ratio)).join(',')})` }
function canvasPoint(canvas, bounds, x, y) { const margin = 34; const scale = Math.min((canvas.clientWidth - margin * 2) / Math.max(bounds.maxX - bounds.minX, 1), (canvas.clientHeight - margin * 2) / Math.max(bounds.maxY - bounds.minY, 1)); return { x: bounds.minX + (x - margin) / scale, y: bounds.minY + (canvas.clientHeight - y - margin) / scale } }
function formatTime(seconds) { const value = Number(seconds) || 0; if (value < 1) return '0s'; const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const remainder = Math.round(value % 60); return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${remainder}s` : `${remainder}s` }
function formatLength(value) { const millimeters = Number(value) || 0; return millimeters >= 1000 ? `${formatNumber(millimeters / 1000, 2)} m` : `${formatNumber(millimeters, 0)} mm` }
function formatWeight(value) { return value ? `${formatNumber(value, 1)} g` : '—' }
function formatNumber(value, digits = 1) { return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—' }
