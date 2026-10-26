import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { parseModelFile } from './modelFormats.js'
export { plateFromProfile } from './profileUtils.js'

export async function loadStlFiles(fileList, plate, existingModels = []) {
  const loader = new STLLoader()
  const files = Array.from(fileList || [])
  const loaded = []
  for (const file of files) {
    const extension = file.name.toLowerCase().split('.').pop()
    let geometry
    let entries
    if (extension === 'stl') {
      geometry = loader.parse(await file.arrayBuffer())
    } else {
      entries = await parseModelFile(file)
    }
    entries ||= [{ geometry, name: file.name }]
    for (const entry of entries) {
    geometry = entry.geometry
    geometry.center()
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox?.getSize(size)
    const model = {
      id: crypto.randomUUID(),
      file,
      name: entry.name,
      geometry,
      dimensions: { x: size.x, y: size.y, z: size.z },
      position: findFreePosition({ x: size.x, y: size.y, z: size.z }, plate, [...existingModels, ...loaded]) || centerPosition(plate, { x: size.x, y: size.y, z: size.z }),
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      scaleVector: { x: 1, y: 1, z: 1 }
    }
    loaded.push(model)
    }
  }
  return loaded
}

export function exportModelsStl(models) {
  const group = new THREE.Group()
  models.filter((model) => model.visible !== false).forEach((model) => {
    const mesh = new THREE.Mesh(model.geometry)
    mesh.position.set(model.position.x, model.position.y, model.position.z)
    mesh.rotation.set(
      THREE.MathUtils.degToRad(model.rotation.x),
      THREE.MathUtils.degToRad(model.rotation.y),
      THREE.MathUtils.degToRad(model.rotation.z)
    )
    const scaleValues = scaleVectorFor(model)
    mesh.scale.set(scaleValues.x, scaleValues.y, scaleValues.z)
    group.add(mesh)
  })
  group.updateMatrixWorld(true)
  const exported = new STLExporter().parse(group, { binary: true })
  group.clear()
  const name = models.length === 1 ? models[0].name.replace(/\.[^.]+$/, '.stl') : 'printhub-plate.stl'
  return new File([exported], name, { type: 'model/stl' })
}

export function arrangeModels(models, plate, options = {}) {
  const { spacing = 0, selectedOnly = false, autoRotate = false, alignY = false } = options
  const selected = models.filter(model => model.visible !== false && (!selectedOnly || model.selected || options.selectedIds?.includes(model.id)))
  const arranged = selectedOnly ? models.filter(model => model.visible !== false && !selected.includes(model)) : []
  const gap = spacing > 0 ? spacing : 2
  const result = []

  models.forEach((model) => {
    if (!selected.includes(model)) {
      result.push(model)
      return
    }
    const alignedRotation = alignY && footprintFor(model.dimensions, scaleVectorFor(model), model.rotation).x > footprintFor(model.dimensions, scaleVectorFor(model), model.rotation).y ? { ...model.rotation, z: model.rotation.z + 90 } : model.rotation
    const rotationCandidates = autoRotate && !alignY ? [alignedRotation, { ...alignedRotation, z: alignedRotation.z + 90 }] : [alignedRotation]
    let placement = null
    let rotation = model.rotation
    for (const candidate of rotationCandidates) {
      placement = findFreePosition(model.dimensions, plate, arranged, scaleVectorFor(model), gap, alignY, candidate)
      if (placement) {
        rotation = candidate
        break
      }
    }
    if (!placement) throw new Error(`Cannot fit ${model.name} on this plate with a ${gap} mm gap. Add a plate or reduce the spacing.`)
    const next = { ...model, rotation, position: placement }
    arranged.push(next)
    result.push(next)
  })
  return result
}

function findFreePosition(dimensions, plate, models, scale = 1, spacing = 1, alignY = false, rotation = {}) {
  const scaleValues = scaleVectorFor(scale)
  const targetFootprint = footprintFor(dimensions, scaleValues, rotation)
  const width = Math.max(targetFootprint.x, 1)
  const depth = Math.max(targetFootprint.y, 1)
  const minX = plate.originX + width / 2
  const maxX = plate.originX + plate.width - width / 2
  const minY = plate.originY + depth / 2
  const maxY = plate.originY + plate.depth - depth / 2
  if (width > plate.width || depth > plate.depth) return null

  const centerX = plate.originX + plate.width / 2
  const centerY = plate.originY + plate.depth / 2
  const ringStep = Math.max(Math.min(width, depth) / 3 + spacing, 2)
  const maxRadius = Math.hypot(plate.width, plate.depth)
  const candidates = [{ x: centerX, y: centerY }]
  for (let radius = ringStep; radius <= maxRadius; radius += ringStep) {
    const count = Math.max(8, Math.ceil((Math.PI * 2 * radius) / ringStep))
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      candidates.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      })
    }
  }

  for (const candidate of candidates) {
    const x = Math.min(Math.max(candidate.x, minX), maxX)
    const y = Math.min(Math.max(candidate.y, minY), maxY)
    const excluded = (plate.exclusions || []).some(exclusion => {
      const points = Array.isArray(exclusion) ? exclusion : exclusion.points
      if (!points?.length) return false
      const zone = new THREE.Box2().setFromPoints(points.map(p => new THREE.Vector2(p.x, p.y)))
      return x + width / 2 + spacing > zone.min.x && x - width / 2 - spacing < zone.max.x && y + depth / 2 + spacing > zone.min.y && y - depth / 2 - spacing < zone.max.y
    })
    const overlaps = models.filter(model => model.visible !== false).some((model) => {
      const otherFootprint = footprintFor(model.dimensions, scaleVectorFor(model), model.rotation)
      return Math.abs(model.position.x - x) < (otherFootprint.x + width) / 2 + spacing &&
        Math.abs(model.position.y - y) < (otherFootprint.y + depth) / 2 + spacing
    })
    if (!overlaps && !excluded) return { x, y, z: targetFootprint.z / 2 }
  }
  return null
}

function footprintFor(dimensions, scale = 1, rotation = {}) {
  const scaleValues = scaleVectorFor(scale)
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...['x', 'y', 'z'].map(axis => THREE.MathUtils.degToRad(Number(rotation[axis]) || 0))))
  const half = new THREE.Vector3(dimensions.x * scaleValues.x / 2, dimensions.y * scaleValues.y / 2, dimensions.z * scaleValues.z / 2)
  const bounds = new THREE.Box3(new THREE.Vector3().copy(half).negate(), half).applyMatrix4(matrix)
  const size = bounds.getSize(new THREE.Vector3())
  return { x: size.x, y: size.y, z: size.z }
}

function centerPosition(plate, dimensions, scale = 1) {
  const scaleValues = scaleVectorFor(scale)
  return { x: plate.originX + plate.width / 2, y: plate.originY + plate.depth / 2, z: dimensions.z * scaleValues.z / 2 }
}

function scaleVectorFor(value) {
  if (value && typeof value === 'object' && 'x' in value) return { x: Number(value.x) || 1, y: Number(value.y) || 1, z: Number(value.z) || 1 }
  if (value && typeof value === 'object' && value.scaleVector) return scaleVectorFor(value.scaleVector)
  const scalar = Number(value) || 1
  return { x: scalar, y: scalar, z: scalar }
}

