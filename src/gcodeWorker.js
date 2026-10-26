const ROLE_NAMES = [
  'Inner wall', 'Outer wall', 'Overhang wall', 'Sparse infill',
  'Internal solid infill', 'Top surface', 'Bottom surface', 'Ironing',
  'Bridge', 'Gap infill', 'Skirt', 'Brim', 'Support',
  'Support interface', 'Support transition', 'Prime tower', 'Custom', 'Travel'
]

const ROLE_IDS = Object.fromEntries(ROLE_NAMES.map((name, index) => [normalizeRole(name), index]))
const TYPE_IDS = { extrude: 0, travel: 1, wipe: 2, retract: 3, deretract: 4, seam: 5, tool: 6, color: 7, pause: 8, custom: 9 }

let cancelled = false

self.onmessage = ({ data }) => {
  if (data?.type === 'cancel') {
    cancelled = true
    return
  }
  if (data?.type !== 'parse') return
  cancelled = false
  parseSource(String(data.source || ''))
}

function parseSource(source) {
  const lines = source.split(/\r?\n/)
  const moves = {
    x1: [], y1: [], x2: [], y2: [], z: [], width: [], height: [], feed: [], speed: [], fan: [], temperature: [], flow: [], pressure: [], acceleration: [], jerk: [], layerTime: [],
    layer: [], role: [], type: [], tool: [], time: [], cumulative: [], line: []
  }
  const layers = []
  const roleStats = ROLE_NAMES.map((name) => ({ name, time: 0, length: 0, weight: 0, moves: 0 }))
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
  const state = { x: 0, y: 0, z: 0, e: 0, layer: 0, layerHeight: 0.2, width: 0.45, feed: 1800, fan: 0, temperature: 0, flowFactor: 1, speedFactor: 1, pressure: 0, acceleration: 0, tool: 0, unit: 1, absolute: true, absoluteExtrusion: true, role: ROLE_IDS.travel, wipe: false, cumulative: 0, previousZ: null }
  const footer = {}
  state.filamentDiameter = Number(source.match(/filament_diameter\s*=\s*([\d.]+)/i)?.[1]) || 1.75
  state.density = Number(source.match(/filament_density\s*=\s*([\d.]+)/i)?.[1]) || 1.24
  let currentLayer = ensureLayer(layers, 0, state.z, state.layerHeight)
  let lineIndex = 0

  function step() {
    const end = Math.min(lineIndex + 5000, lines.length)
    for (; lineIndex < end; lineIndex += 1) {
      if (cancelled) return self.postMessage({ type: 'cancelled' })
      try {
        parseLine(lines[lineIndex], lineIndex + 1, state, moves, layers, roleStats, bounds, footer)
      } catch (error) {
        return self.postMessage({ type: 'error', message: `${error?.message || 'Invalid G-code'} (line ${lineIndex + 1})` })
      }
      if (state.layer >= layers.length) currentLayer = ensureLayer(layers, state.layer, state.z, state.layerHeight)
    }
    self.postMessage({ type: 'progress', value: lines.length ? lineIndex / lines.length : 1 })
    if (lineIndex < lines.length) return setTimeout(step, 0)
    const output = finalize(moves, layers, roleStats, bounds, footer, lines.length)
    const transfers = Object.values(output.moves).filter((value) => ArrayBuffer.isView(value)).map((value) => value.buffer)
    self.postMessage({ type: 'complete', ...output }, transfers)
  }
  step()
}

function parseLine(rawLine, lineNumber, state, moves, layers, roleStats, bounds, footer) {
  const semicolon = rawLine.indexOf(';')
  const command = semicolon >= 0 ? rawLine.slice(0, semicolon).trim() : rawLine.trim()
  const comment = semicolon >= 0 ? rawLine.slice(semicolon + 1).trim() : ''
  const upperComment = comment.toUpperCase()
  if (comment) parseComment(comment, state, layers, footer)
  if (/^G20\b/i.test(command)) state.unit = 25.4
  if (/^G21\b/i.test(command)) state.unit = 1
  if (/^G90\b/i.test(command)) state.absolute = true
  if (/^G91\b/i.test(command)) state.absolute = false
  if (/^M82\b/i.test(command)) state.absoluteExtrusion = true
  if (/^M83\b/i.test(command)) state.absoluteExtrusion = false
  if (/^G92\b/i.test(command)) {
    const axes = readAxes(command)
    if (axes.x !== null) state.x = axes.x * (state.unit || 1)
    if (axes.y !== null) state.y = axes.y * (state.unit || 1)
    if (axes.z !== null) state.z = axes.z * (state.unit || 1)
    if (axes.e !== null) state.e = axes.e * (state.unit || 1)
    return
  }
  if (/^T\d+/i.test(command)) {
    state.tool = Number(command.match(/^T(\d+)/i)?.[1] || 0)
    addMarker(moves, state, lineNumber, TYPE_IDS.tool)
    return
  }
  if (/^M600\b/i.test(command)) return addMarker(moves, state, lineNumber, TYPE_IDS.color)
  if (/^(M601|M25|M0|M1)\b/i.test(command)) return addMarker(moves, state, lineNumber, TYPE_IDS.pause)
  if (/^M107\b/i.test(command)) state.fan = 0
  if (/^M106\b/i.test(command)) state.fan = (readAxes(command).s ?? 0) / 255 * 100
  const temperature = readAxes(command).s
  if (/^(M104|M109)\b/i.test(command) && temperature !== null) state.temperature = temperature
  if (/^M220\b/i.test(command)) state.speedFactor = (temperature || 100) / 100
  if (/^M221\b/i.test(command)) state.flowFactor = (temperature || 100) / 100
  if (/^M204\b/i.test(command)) state.acceleration = temperature || state.acceleration
  if (/^M205\b/i.test(command)) state.jerk = readAxes(command).x ?? 0
  if (/^(M900|SET_PRESSURE_ADVANCE)/i.test(command)) state.pressure = readAxes(command).k ?? (Number(command.match(/ADVANCE=([\d.]+)/i)?.[1]) || state.pressure)
  if (/WIPE_START/i.test(upperComment)) state.wipe = true
  if (/WIPE_END/i.test(upperComment)) state.wipe = false
  if (!/^(G0|G1|G2|G3)\b/i.test(command)) {
    if (comment && !/^LAYER_CHANGE|^Z:|^HEIGHT:|^WIDTH:|^TYPE:/i.test(comment) && !/^TIME_ELAPSED/i.test(comment)) addMarker(moves, state, lineNumber, TYPE_IDS.custom)
    return
  }
  const axes = readAxes(command)
  if (axes.f !== null) state.feed = axes.f * (state.unit || 1)
  const unit = state.unit || 1
  const next = {
    x: axes.x === null ? state.x : (state.absolute ? axes.x * unit : state.x + axes.x * unit),
    y: axes.y === null ? state.y : (state.absolute ? axes.y * unit : state.y + axes.y * unit),
    z: axes.z === null ? state.z : (state.absolute ? axes.z * unit : state.z + axes.z * unit),
    e: axes.e === null ? state.e : (state.absoluteExtrusion ? axes.e * unit : state.e + axes.e * unit),
  }
  if (!state.hasLayerComments && next.e > state.e && Math.hypot(next.x - state.x, next.y - state.y) > .001) {
    if (state.previousZ !== null && next.z > state.previousZ + .001) state.layer++
    state.previousZ = next.z
  }
  if (state.layer >= layers.length) ensureLayer(layers, state.layer, next.z, state.layerHeight)
  if (/^G2|^G3/i.test(command)) addArcMoves(command, axes, next, state, moves, roleStats, bounds, lineNumber)
  else addMove(state.x, state.y, next.x, next.y, next.z, next.e - state.e, state, moves, roleStats, bounds, lineNumber, state.wipe ? TYPE_IDS.wipe : null)
  state.x = next.x; state.y = next.y; state.z = next.z; state.e = next.e
}

function parseComment(comment, state, layers, footer) {
  const layerChange = comment.match(/^LAYER_CHANGE/i)
  const z = comment.match(/^Z:\s*(-?\d+(?:\.\d+)?)/i)
  const height = comment.match(/^HEIGHT:\s*(\d+(?:\.\d+)?)/i)
  const width = comment.match(/^WIDTH:\s*(\d+(?:\.\d+)?)/i)
  const type = comment.match(/^TYPE:\s*(.+)$/i)
  if (layerChange) { if (state.hasLayerComments) state.layer++; state.hasLayerComments = true; ensureLayer(layers, state.layer, state.z, state.layerHeight) }
  if (z) { ensureLayer(layers, state.layer, Number(z[1]), state.layerHeight).z = Number(z[1]) }
  if (height) state.layerHeight = Number(height[1])
  if (width) state.width = Number(width[1])
  if (type) {
    const normalized = normalizeRole(type[1])
    state.role = ROLE_IDS[normalized]
      ?? (normalized.includes('skirt') ? ROLE_IDS.skirt : null)
      ?? (normalized.includes('brim') ? ROLE_IDS.brim : null)
      ?? ROLE_IDS.travel
  }
  const footerPatterns = [
    ['timeSeconds', /estimated printing time(?:\s*\(normal mode\))?\s*[:=]\s*(.+)$/i],
    ['filamentLength', /filament used\s*\[mm\]\s*=\s*([\d.]+)/i],
    ['filamentWeight', /filament used\s*\[g\]\s*=\s*([\d.]+)/i],
    ['layerCount', /total layer number\s*=\s*(\d+)/i],
    ['filamentCost', /filament cost\s*=\s*([\d.]+)/i]
  ]
  footerPatterns.forEach(([key, pattern]) => { const match = comment.match(pattern); if (match) footer[key] = key === 'timeSeconds' ? parseDuration(match[1]) : Number(match[1]) })
}

function addArcMoves(command, axes, next, state, moves, roleStats, bounds, lineNumber) {
  const i = (axes.i || 0) * (state.unit || 1)
  const j = (axes.j || 0) * (state.unit || 1)
  let cx = state.x + i; let cy = state.y + j
  if (!i && !j && axes.r !== null) {
    const dx = next.x - state.x, dy = next.y - state.y, chord = Math.hypot(dx, dy), r = Math.abs(axes.r * (state.unit || 1))
    if (chord > 2 * r + .001 || !chord) throw new Error('Invalid G-code arc radius')
    const h = Math.sqrt(Math.max(0, r * r - chord * chord / 4)), sign = (/^G2/i.test(command) ? -1 : 1) * (axes.r < 0 ? -1 : 1)
    cx = (state.x + next.x) / 2 - dy / chord * h * sign; cy = (state.y + next.y) / 2 + dx / chord * h * sign
  }
  const radius = Math.hypot(state.x - cx, state.y - cy)
  const startAngle = Math.atan2(state.y - cy, state.x - cx)
  let endAngle = Math.atan2(next.y - cy, next.x - cx)
  let sweep = endAngle - startAngle
  const clockwise = /^G2/i.test(command)
  if (Math.abs(sweep) < 1e-10) sweep = clockwise ? -Math.PI * 2 : Math.PI * 2
  if (clockwise && sweep > 0) sweep -= Math.PI * 2
  if (!clockwise && sweep < 0) sweep += Math.PI * 2
  const steps = Math.max(2, Math.min(256, Math.ceil(Math.abs(sweep) * Math.max(radius, 1) / 1.2)))
  let px = state.x; let py = state.y
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps
    const angle = startAngle + sweep * ratio
    const tx = index === steps ? next.x : cx + Math.cos(angle) * Math.max(radius, 0.01)
    const ty = index === steps ? next.y : cy + Math.sin(angle) * Math.max(radius, 0.01)
    const tz = state.z + (next.z - state.z) * ratio
    const previousZ = state.z + (next.z - state.z) * ((index - 1) / steps)
    addMove(px, py, tx, ty, tz, (next.e - state.e) / steps, state, moves, roleStats, bounds, lineNumber, null, previousZ)
    px = tx; py = ty
  }
}

function addMove(x1, y1, x2, y2, z, extrusion, state, moves, roleStats, bounds, lineNumber, forcedType = null, startZ = state.z) {
  const distance = Math.hypot(x2 - x1, y2 - y1, z - startZ)
  if (distance < 0.00001 && Math.abs(extrusion) < 0.00001) return
  const type = forcedType ?? (extrusion < -0.00001 ? TYPE_IDS.retract : extrusion > 0.00001 ? (distance < .00001 ? TYPE_IDS.deretract : TYPE_IDS.extrude) : TYPE_IDS.travel)
  const feed = Math.max(state.feed * (state.speedFactor || 1), 1)
  const time = distance / feed * 60
  const role = type === TYPE_IDS.travel || type === TYPE_IDS.retract || type === TYPE_IDS.deretract ? ROLE_IDS.travel : state.role
  const layer = state.layer
  const volume = Math.max(extrusion, 0) * Math.PI * (state.filamentDiameter / 2) ** 2 * state.flowFactor
  const weight = volume * state.density / 1000
  push(moves.jerk, state.jerk || 0); push(moves.layerTime, 0)
  push(moves.x1, x1); push(moves.y1, y1); push(moves.x2, x2); push(moves.y2, y2); push(moves.z, z); push(moves.width, state.width); push(moves.height, state.layerHeight)
  push(moves.feed, feed); push(moves.speed, distance / Math.max(time, 0.0001)); push(moves.fan, state.fan); push(moves.temperature, state.temperature); push(moves.flow, volume / Math.max(time, 0.0001)); push(moves.pressure, state.pressure); push(moves.acceleration, state.acceleration); push(moves.layer, layer); push(moves.role, role); push(moves.type, type); push(moves.tool, state.tool); push(moves.time, time); state.cumulative += time; push(moves.cumulative, state.cumulative); push(moves.line, lineNumber)
  const stats = roleStats[role] || roleStats[ROLE_IDS.travel]
  stats.time += time; stats.length += Math.max(extrusion, 0); stats.weight += weight; stats.moves += 1
  bounds.minX = Math.min(bounds.minX, x1, x2); bounds.maxX = Math.max(bounds.maxX, x1, x2); bounds.minY = Math.min(bounds.minY, y1, y2); bounds.maxY = Math.max(bounds.maxY, y1, y2); bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z)
  const current = layersFor(state.layer)
  if (current) { current.time += time; current.moveCount += 1; current.cumulative = state.cumulative }
}

let layersForCurrent = []
function layersFor(index) { return layersForCurrent[index] }
function ensureLayer(layers, index, z, height) {
  while (layers.length <= index) layers.push({ index: layers.length, z: z || 0, height: height || 0.2, time: 0, cumulative: 0, moveCount: 0 })
  layersForCurrent = layers
  return layers[index]
}

function addMarker(moves, state, lineNumber, type) {
  push(moves.jerk, state.jerk || 0); push(moves.layerTime, 0)
  const marker = { x1: state.x, y1: state.y, x2: state.x, y2: state.y, z: state.z, width: state.width, height: state.layerHeight, feed: state.feed, speed: 0, fan: state.fan, temperature: state.temperature, flow: 0, pressure: state.pressure, acceleration: state.acceleration, layer: state.layer, role: ROLE_IDS.travel, type, tool: state.tool, time: 0, cumulative: state.cumulative, line: lineNumber }
  Object.entries(marker).forEach(([key, value]) => push(moves[key], value))
}

function finalize(moves, layers, roleStats, bounds, footer, lineCount) {
  for (let i = 0; i < moves.layer.length; i++) moves.layerTime[i] = layers[moves.layer[i]]?.time || 0
  const typed = {}
  const types = { x1: Float32Array, y1: Float32Array, x2: Float32Array, y2: Float32Array, z: Float32Array, width: Float32Array, height: Float32Array, feed: Float32Array, speed: Float32Array, fan: Float32Array, temperature: Float32Array, flow: Float32Array, pressure: Float32Array, acceleration: Float32Array, time: Float32Array, cumulative: Float32Array, layer: Uint32Array, role: Uint8Array, type: Uint8Array, tool: Uint8Array, line: Uint32Array }
  Object.entries(moves).forEach(([key, values]) => { const Type = types[key] || Float32Array; typed[key] = new Type(values) })
  const totalTime = footer.timeSeconds || (typed.cumulative.length ? typed.cumulative[typed.cumulative.length - 1] : 0)
  return { moves: typed, layers, roleStats, bounds: finiteBounds(bounds), footer: { ...footer, totalTime }, lineCount, roles: ROLE_NAMES, types: TYPE_IDS }
}

function finiteBounds(bounds) {
  return Number.isFinite(bounds.minX) ? bounds : { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
}

function push(list, value) { if (list) list.push(Number.isFinite(value) ? value : 0) }

function readAxes(line) {
  const value = (axis) => { const match = line.match(new RegExp(`(?:^|\\s)${axis}([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?)`, 'i')); return match ? Number(match[1]) : null }
  return { x: value('X'), y: value('Y'), z: value('Z'), e: value('E'), i: value('I'), j: value('J'), r: value('R'), f: value('F'), s: value('S'), k: value('K') }
}

function normalizeRole(value) { return String(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() }
function parseDuration(value) { const parts = String(value).match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?/i); return parts ? Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0) : Number(value) || 0 }
