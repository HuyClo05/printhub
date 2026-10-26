import * as THREE from 'three'
import { zipSync, strToU8 } from 'fflate'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { mergeMeshGeometry } from './modelFormats.js'

export function modelMesh(model) {
  const mesh = new THREE.Mesh(model.geometry)
  mesh.position.set(model.position.x, model.position.y, model.position.z)
  mesh.rotation.set(...['x', 'y', 'z'].map(k => THREE.MathUtils.degToRad(model.rotation[k] || 0)))
  const s = model.scaleVector || { x: model.scale || 1, y: model.scale || 1, z: model.scale || 1 }
  mesh.scale.set(s.x, s.y, s.z); mesh.updateMatrixWorld(true)
  return mesh
}
export function fromGeometry(geometry, name, position) {
  geometry.computeVertexNormals(); geometry.computeBoundingBox()
  const size = geometry.boundingBox.getSize(new THREE.Vector3())
  const center = geometry.boundingBox.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  return { id: crypto.randomUUID(), name, geometry, dimensions: { x: size.x, y: size.y, z: size.z }, position: position || { x: center.x, y: center.y, z: center.z }, rotation: { x: 0, y: 0, z: 0 }, scaleVector: { x: 1, y: 1, z: 1 }, visible: true }
}
export function validatePlate(models, plate) {
  const issues = [], boxes = []
  models.filter(m => m.visible !== false).forEach(model => {
    const mesh = modelMesh(model), box = new THREE.Box3().setFromObject(mesh)
    if (box.min.x < plate.originX - .05 || box.min.y < plate.originY - .05 || box.max.x > plate.originX + plate.width + .05 || box.max.y > plate.originY + plate.depth + .05 || box.min.z < -.05 || box.max.z > plate.height + .05) issues.push(`${model.name} is outside the printable volume.`)
    for (const exclusion of plate.exclusions || []) {
      const points = Array.isArray(exclusion) ? exclusion : exclusion.points
      if (points?.length) {
        const zone = new THREE.Box2().setFromPoints(points.map(p => new THREE.Vector2(p.x, p.y)))
        if (zone.max.x > zone.min.x && zone.max.y > zone.min.y && zone.intersectsBox(new THREE.Box2(new THREE.Vector2(box.min.x, box.min.y), new THREE.Vector2(box.max.x, box.max.y)))) issues.push(`${model.name} intersects a bed exclusion zone.`)
      }
    }
    // Bounding box overlap is conservative; ask users to arrange before slicing.
    if (!model.assemblyId) for (const other of boxes) if (!other.model.assemblyId && box.clone().expandByScalar(-.05).intersectsBox(other.box)) issues.push(`${model.name} overlaps ${other.model.name}; arrange the plate or assemble the parts.`)
    boxes.push({ model, box })
  })
  return [...new Set(issues)]
}
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
function paintCode(value) { return value < 3 ? (value << 2).toString(16).toUpperCase() : `${(value - 3).toString(16).toUpperCase()}C` }
export function exportPlate3mf(models) {
  models = models.filter(m => m.visible !== false)
  const resources = [], items = [], metadata = [], ranges = []
  models.forEach((model, index) => {
    const geometry = model.geometry.index ? model.geometry.toNonIndexed() : model.geometry.clone()
    geometry.applyMatrix4(modelMesh(model).matrixWorld)
    const position = geometry.attributes.position
    const meshId = index * 2 + 1, objectId = index * 2 + 2
    const vertices = [], triangles = []
    for (let i = 0; i < position.count; i++) vertices.push(`<vertex x="${position.getX(i)}" y="${position.getY(i)}" z="${position.getZ(i)}"/>`)
    for (let i = 0; i < position.count; i += 3) {
      const paint = model.painting?.[i / 3] || {}
      const attributes = Object.entries({ support: 'paint_supports', seam: 'paint_seam', fuzzy: 'paint_fuzzy_skin', material: 'paint_color' }).filter(([key]) => paint[key]).map(([key, attribute]) => `${attribute}="${paintCode(Number(paint[key]))}"`).join(' ')
      triangles.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" ${attributes}/>`)
    }
    resources.push(`<object id="${meshId}" type="model"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object><object id="${objectId}" type="model" name="${escape(model.name)}"><components><component objectid="${meshId}"/></components></object>`)
    items.push(`<item objectid="${objectId}" printable="1"/>`)
    const settings = { ...model.settings }
    if (Object.values(model.painting || {}).some(p => p.support)) settings.enable_support = '1'
    metadata.push(`<object id="${objectId}"><metadata key="name" value="${escape(model.name)}"/>${Object.entries(settings).map(([key, value]) => `<metadata key="${escape(key)}" value="${escape(value)}"/>`).join('')}<part id="${meshId}" subtype="normal_part"><metadata key="name" value="${escape(model.name)}"/></part></object>`)
    if (model.layerRanges?.length) ranges.push(`<object id="${index + 1}">${model.layerRanges.map(range => `<range min_z="${range.min}" max_z="${range.max}">${Object.entries(range.settings).map(([key, value]) => `<option opt_key="${escape(key)}">${escape(value)}</option>`).join('')}</range>`).join('')}</object>`)
    geometry.dispose()
  })
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(`<?xml version="1.0"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="BambuStudio:FdmSupportsPaintingVersion">0</metadata><metadata name="BambuStudio:SeamPaintingVersion">0</metadata><metadata name="BambuStudio:MmPaintingVersion">0</metadata><resources>${resources.join('')}</resources><build>${items.join('')}</build></model>`),
    'Metadata/model_settings.config': strToU8(`<?xml version="1.0"?><config>${metadata.join('')}<plate><metadata key="plater_id" value="1"/>${models.map((m, i) => `<model_instance><metadata key="object_id" value="${i * 2 + 2}"/><metadata key="instance_id" value="0"/></model_instance>`).join('')}</plate></config>`)
  }
  if (ranges.length) files['Metadata/layer_config_ranges.xml'] = strToU8(`<?xml version="1.0"?><objects>${ranges.join('')}</objects>`)
  return new File([zipSync(files, { level: 3 })], 'printhub-plate.3mf', { type: 'model/3mf' })
}

function splitConnected(geometry) {
  const plain = new THREE.BufferGeometry(); plain.setAttribute('position', geometry.attributes.position.clone())
  if (geometry.index) plain.setIndex(geometry.index.clone())
  const welded = mergeVertices(plain, 1e-5), index = welded.index.array, count = index.length / 3
  const parent = Array.from({ length: count }, (_, i) => i), vertexFace = new Map()
  const root = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  for (let i = 0; i < count; i++) for (let j = 0; j < 3; j++) { const vertex = index[i * 3 + j]; if (vertexFace.has(vertex)) parent[root(i)] = root(vertexFace.get(vertex)); else vertexFace.set(vertex, i) }
  const groups = new Map(), p = welded.attributes.position
  for (let i = 0; i < count; i++) { const key = root(i); if (!groups.has(key)) groups.set(key, []); for (let j = 0; j < 3; j++) { const v = index[i * 3 + j]; groups.get(key).push(p.getX(v), p.getY(v), p.getZ(v)) } }
  return [...groups.values()].map(array => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(array, 3)))
}

export async function runModelAction(action, models, selectedIds, plate, options = {}) {
  const selected = models.filter(m => selectedIds.includes(m.id))
  if (!selected.length && !['text', 'primitive'].includes(action)) throw new Error('Select one or more objects first')
  const remaining = models.filter(m => !selectedIds.includes(m.id))
  if (action === 'clear-paint') return { models: models.map(m => selectedIds.includes(m.id) ? { ...m, painting: Object.fromEntries(Object.entries(m.painting || {}).map(([face, marks]) => [face, Object.fromEntries(Object.entries(marks).filter(([key]) => key !== options.tool))])) } : m) }
  if (action === 'split' || action === 'split-parts') {
    const parts = selected.flatMap(model => splitConnected(model.geometry.clone().applyMatrix4(modelMesh(model).matrixWorld)).map((g, i) => fromGeometry(g, `${model.name} part ${i + 1}`)))
    if (parts.length <= selected.length) throw new Error('Selected mesh has no disconnected parts')
    if (action === 'split-parts') { const assemblyId = crypto.randomUUID(); parts.forEach(part => { part.assemblyId = assemblyId }) }
    return { models: [...remaining, ...parts], selectedIds: parts.map(m => m.id) }
  }
  if (action === 'assembly') {
    if (selected.length < 2) throw new Error('Select at least two objects to assemble')
    const merged = fromGeometry(mergeMeshGeometry(selected.map(m => m.geometry.clone().applyMatrix4(modelMesh(m).matrixWorld))), 'Assembly')
    return { models: [...remaining, merged], selectedIds: [merged.id] }
  }
  if (action === 'meshboolean' || action === 'cut') {
    const { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } = await import('three-bvh-csg')
    const evaluator = new Evaluator(); evaluator.attributes = ['position', 'normal']; evaluator.useGroups = false
    const brush = model => { const g = model.geometry.clone().applyMatrix4(modelMesh(model).matrixWorld); g.computeVertexNormals(); const b = new Brush(g); b.updateMatrixWorld(true); return b }
    if (action === 'cut') {
      const model = selected[0], bounds = new THREE.Box3().setFromObject(modelMesh(model)), axis = options.axis || 'z', at = Number(options.at)
      if (!Number.isFinite(at) || at <= bounds.min[axis] || at >= bounds.max[axis]) throw new Error('Cut position must fall inside the model bounds')
      const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(4).addScalar(10), center = bounds.getCenter(new THREE.Vector3())
      size[axis] = bounds.max[axis] - at + 10; center[axis] = at + size[axis] / 2
      const cutter = new Brush(new THREE.BoxGeometry(size.x, size.y, size.z)); cutter.position.copy(center); cutter.updateMatrixWorld(true)
      const lower = evaluator.evaluate(brush(model), cutter, SUBTRACTION), upper = evaluator.evaluate(brush(model), cutter, INTERSECTION)
      const parts = [lower, upper].filter(p => p.geometry.attributes.position.count).map((p, i) => fromGeometry(p.geometry.clone(), `${model.name} ${i ? 'upper' : 'lower'}`))
      parts.forEach((p, i) => { p.position.z = p.dimensions.z / 2; p.position.x += i * (p.dimensions.x + 3) })
      return { models: [...models.filter(m => m.id !== model.id), ...parts], selectedIds: parts.map(p => p.id) }
    }
    if (selected.length !== 2) throw new Error('Select exactly two models; the first selection is the base')
    const base = models.find(m => m.id === selectedIds[0]), other = models.find(m => m.id === selectedIds[1])
    const result = evaluator.evaluate(brush(base), brush(other), { union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }[options.operation || 'union'])
    if (!result.geometry.attributes.position.count) throw new Error('The boolean operation produced an empty mesh')
    const model = fromGeometry(result.geometry.clone(), `${base.name} ${options.operation || 'union'}`)
    return { models: [...remaining, model], selectedIds: [model.id] }
  }
  if (action === 'layers') {
    const min = Number(options.min || 0), max = Number(options.max), height = Number(options.height)
    if (!(min >= 0 && max > min && height >= .02 && height <= 1)) throw new Error('Enter a valid Z range and layer height between 0.02 and 1 mm')
    return { models: models.map(m => selectedIds.includes(m.id) ? { ...m, layerRanges: [...(m.layerRanges || []), { min, max, settings: { layer_height: String(height) } }] } : m) }
  }
  if (action === 'text') {
    const fontData = await import('./assets/helvetiker_regular.typeface.json')
    const font = new FontLoader().parse(fontData.default)
    const text = String(options.text || 'PrintHub').slice(0, 100)
    const geometry = new TextGeometry(text, { font, size: Number(options.size) || 10, depth: Number(options.depth) || 2, curveSegments: 6, bevelEnabled: false })
    const model = fromGeometry(geometry, text)
    model.position = { x: plate.originX + plate.width / 2, y: plate.originY + plate.depth / 2, z: model.dimensions.z / 2 }
    return { models: [...models, model], selectedIds: [model.id] }
  }
  if (action === 'mmu') return { models: models.map(m => selectedIds.includes(m.id) ? { ...m, settings: { ...m.settings, extruder: String(options.extruder || 1) } } : m) }
  throw new Error(`Unknown model action: ${action}`)
}

export function calibrationModels(kind, options, plate) {
  const start = Number(options.start), end = Number(options.end), step = Number(options.step)
  if (!Number.isFinite(start + end + step) || step === 0 || (end - start) / step < 0) throw new Error('Enter a valid calibration range and step')
  const count = Math.floor((end - start) / step + .00001) + 1
  if (count < 2 || count > 30) throw new Error('Use between 2 and 30 calibration values')
  const key = { Temperature: 'nozzle_temperature', 'Volumetric Speed': 'filament_max_volumetric_speed', 'Pressure Advance': 'pressure_advance', 'Flow Ratio': 'filament_flow_ratio', Retraction: 'filament_retraction_length', Tolerance: 'xy_contour_compensation' }[kind]
  if (!key) throw new Error('Choose a calibration type')
  if (kind === 'Tolerance') return Array.from({ length: count }, (_, index) => {
    const g = new THREE.TorusGeometry(5, 1.5, 12, 40)
    const value = Number((start + index * step).toFixed(4))
    const coupon = fromGeometry(g, `Tolerance ${value} mm`)
    coupon.position = { x: plate.originX + 20 + (index % 6) * 25, y: plate.originY + 20 + Math.floor(index / 6) * 25, z: coupon.dimensions.z / 2 }
    coupon.settings = { xy_contour_compensation: String(value) }
    return coupon
  })
  const model = fromGeometry(new THREE.BoxGeometry(20, 20, count * 5), `${kind} tower ${start} to ${end}`)
  model.position = { x: plate.originX + plate.width / 2, y: plate.originY + plate.depth / 2, z: count * 2.5 }
  model.calibration = { kind, start, end, step, bandHeight: 5, key }
  model.settings = { wall_loops: '2', sparse_infill_density: '0%', top_shell_layers: '0', bottom_shell_layers: '3' }
  return [model]
}

export function applyCalibrationGcode(source, calibration) {
  if (!calibration) return source
  const { kind, start, end, step, bandHeight = 5 } = calibration
  let band = -1
  const output = []
  for (const line of source.split(/\r?\n/)) {
    output.push(line)
    const z = line.match(/^;\s*(?:Z_HEIGHT|Z)\s*:\s*([\d.]+)/i)
    if (!z) continue
    const nextBand = Math.min(Math.floor((Number(z[1]) - .001) / bandHeight), Math.round((end - start) / step))
    if (nextBand === band) continue
    band = nextBand; const value = Number((start + band * step).toFixed(5))
    const command = { Temperature: `M104 S${value}`, 'Pressure Advance': `SET_PRESSURE_ADVANCE ADVANCE=${value}`, 'Flow Ratio': `M221 S${Math.round(value * 100)}`, Retraction: `SET_RETRACTION RETRACT_LENGTH=${value}` }[kind]
    if (command) output.push(`; PrintHub ${kind} band ${band + 1}: ${value}`, command)
  }
  return output.join('\n')
}
