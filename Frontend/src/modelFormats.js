import * as THREE from 'three'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

let occtPromise
export async function parseModelFile(file) {
  const extension = file.name.toLowerCase().split('.').pop()
  if (['step', 'stp'].includes(extension)) {
    // Load OpenCascade only when a STEP file is imported. Keep its WASM in
    // the built assets rather than requesting an unrelated CDN at runtime.
    if (!occtPromise) occtPromise = Promise.all([import('occt-import-js'), import('occt-import-js/dist/occt-import-js.wasm?url')]).then(([module, wasm]) => module.default({ locateFile: () => wasm.default }))
    const occt = await occtPromise
    const result = occt.ReadStepFile(new Uint8Array(await file.arrayBuffer()), null)
    if (!result.success || !result.meshes?.length) throw new Error(`${file.name}: OpenCascade could not read the STEP model`)
    return result.meshes.map((mesh, index) => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3))
      geometry.setIndex(mesh.index.array)
      geometry.computeVertexNormals()
      return { geometry, name: mesh.name || `${file.name} ${index + 1}` }
    })
  }
  let object
  if (extension === 'obj') object = new OBJLoader().parse(await file.text())
  else if (extension === '3mf') object = new ThreeMFLoader().parse(await file.arrayBuffer())
  else if (extension === 'amf') object = new AMFLoader().parse(await file.arrayBuffer())
  else throw new Error(`${file.name}: import STL, OBJ, 3MF, STEP, or AMF files`)
  object.updateMatrixWorld(true)
  const meshes = []
  object.traverse((mesh) => {
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    meshes.push({ geometry, name: mesh.name || file.name })
  })
  if (!meshes.length) throw new Error(`${file.name}: no mesh geometry was found`)
  return meshes
}

export function mergeMeshGeometry(geometries) {
  return mergeGeometries(geometries.map((source) => {
    const geometry = source.index ? source.toNonIndexed() : source.clone()
    Object.keys(geometry.attributes).forEach((name) => { if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name) })
    geometry.computeVertexNormals()
    return geometry
  }))
}
