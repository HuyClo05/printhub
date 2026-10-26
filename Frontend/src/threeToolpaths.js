import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function createToolpathScene(canvas, parsed, plate, colorForMove) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#282a2e')
  const frame = new THREE.Group(); frame.rotation.x = -Math.PI / 2; scene.add(frame)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6068, 2.4))
  const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(100, 400, 100); scene.add(light)
  const bounds = parsed.bounds
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, (bounds.maxZ + bounds.minZ) / 2, -(bounds.minY + bounds.maxY) / 2)
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ, plate?.width || 200, 10)
  const perspective = new THREE.PerspectiveCamera(42, 1, .1, span * 100)
  const orthographic = new THREE.OrthographicCamera(-span, span, span, -span, .1, span * 100)
  let camera = perspective
  const orbit = new OrbitControls(camera, canvas)
  orbit.enableDamping = true
  orbit.target.copy(center)
  camera.position.copy(center).add(new THREE.Vector3(span * .85, span, span * .95)); orbit.update()
  const bedWidth = plate?.width || Math.max(bounds.maxX, 200)
  const bedDepth = plate?.depth || Math.max(bounds.maxY, 200)
  const originX = plate?.originX || 0, originY = plate?.originY || 0
  const bed = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, bedDepth, .8), new THREE.MeshStandardMaterial({ color: '#393c42', roughness: .9 }))
  bed.position.set(originX + bedWidth / 2, originY + bedDepth / 2, -.7); frame.add(bed)
  const grid = new THREE.GridHelper(Math.max(bedWidth, bedDepth), Math.max(2, Math.round(Math.max(bedWidth, bedDepth) / 10)), '#72767d', '#464950')
  grid.position.set(originX + bedWidth / 2, -.15, -(originY + bedDepth / 2)); scene.add(grid)
  const moves = parsed.moves
  const capacity = Math.max(1, moves.line.length)
  const material = new THREE.MeshStandardMaterial({ roughness: .66, metalness: .03 })
  const paths = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity)
  paths.instanceMatrix.setUsage(THREE.DynamicDrawUsage); paths.frustumCulled = false; frame.add(paths)
  const lineGeometry = new THREE.BufferGeometry()
  const travel = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#8a94a5', transparent: true, opacity: .35 })); frame.add(travel)
  const markerGeometry = new THREE.BufferGeometry()
  const markers = new THREE.Points(markerGeometry, new THREE.PointsMaterial({ size: 4, vertexColors: true, depthTest: false })); markers.renderOrder = 4; frame.add(markers)
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 12), new THREE.MeshStandardMaterial({ color: '#ffcb57' }))
  nozzle.rotation.x = Math.PI / 2; frame.add(nozzle)
  let sourceIndexes = []
  let shells
  const shellMaterial = new THREE.MeshStandardMaterial({ color: '#a9b7c4', transparent: true, opacity: .12, depthWrite: false })
  const temp = new THREE.Object3D(), color = new THREE.Color()
  function update(state) {
    let count = 0; const travelPoints = [], markerPoints = [], markerColors = []; sourceIndexes = []
    for (let i = 0; i < moves.line.length && i <= state.moveIndex; i++) {
      if (moves.layer[i] < state.layerLow || moves.layer[i] > state.layerHigh) continue
      const role = parsed.roles[moves.role[i]]
      if (state.roleVisibility[role] === false) continue
      const type = moves.type[i]
      if (type !== 0) {
        const option = ['toolpaths', 'travel', 'wipe', 'retract', 'deretract', 'seams', 'tool', 'color', 'pause', 'custom'][type]
        if (state.options[option] !== false) {
          if (type === 1 || type === 2) travelPoints.push(moves.x1[i], moves.y1[i], moves.z[i], moves.x2[i], moves.y2[i], moves.z[i])
          else { markerPoints.push(moves.x2[i], moves.y2[i], moves.z[i]); color.set(['#ffffff', '#717b90', '#d69c58', '#dc6f7b', '#70c7bd', '#ffffff', '#83baff', '#f0d15b', '#ec8fc9', '#ffa75b'][type]); markerColors.push(color.r, color.g, color.b) }
        }
        continue
      }
      if (!state.options.toolpaths) continue
      const dx = moves.x2[i] - moves.x1[i], dy = moves.y2[i] - moves.y1[i]
      temp.position.set((moves.x1[i] + moves.x2[i]) / 2, (moves.y1[i] + moves.y2[i]) / 2, moves.z[i] - moves.height[i] / 2)
      temp.rotation.set(0, 0, Math.atan2(dy, dx))
      temp.scale.set(Math.max(Math.hypot(dx, dy), .01), Math.max(moves.width[i], .15), Math.max(moves.height[i], .03))
      temp.updateMatrix(); paths.setMatrixAt(count, temp.matrix)
      color.set(colorForMove(parsed, moves, i, state.viewType))
      if (state.options.dimLower && moves.layer[i] < state.layerHigh) color.multiplyScalar(.32)
      paths.setColorAt(count, color); sourceIndexes.push(i); count++
    }
    paths.count = count; paths.instanceMatrix.needsUpdate = true
    if (paths.instanceColor) paths.instanceColor.needsUpdate = true
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(travelPoints, 3)); lineGeometry.computeBoundingSphere()
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markerPoints, 3)); markerGeometry.setAttribute('color', new THREE.Float32BufferAttribute(markerColors, 3)); markerGeometry.computeBoundingSphere()
    const i = Math.min(Math.max(state.moveIndex, 0), moves.line.length - 1)
    nozzle.visible = i >= 0
    if (i >= 0) nozzle.position.set(moves.x2[i], moves.y2[i], moves.z[i] + 2)
    if (shells) frame.remove(shells)
    shells = new THREE.Group()
    if (state.options.shells) (state.models || []).filter(m => m.visible !== false).forEach(model => {
      const mesh = new THREE.Mesh(model.geometry, shellMaterial)
      mesh.position.set(model.position.x, model.position.y, model.position.z)
      mesh.rotation.set(...['x', 'y', 'z'].map(k => THREE.MathUtils.degToRad(model.rotation[k])))
      const s = model.scaleVector || { x: 1, y: 1, z: 1 }; mesh.scale.set(s.x, s.y, s.z); shells.add(mesh)
    })
    frame.add(shells)
  }
  function resize() {
    const width = Math.max(canvas.parentElement.clientWidth, 1), height = Math.max(canvas.parentElement.clientHeight, 1)
    renderer.setSize(width, height, false)
    perspective.aspect = width / height; perspective.updateProjectionMatrix()
    orthographic.left = -span * width / height / 2; orthographic.right = span * width / height / 2
    orthographic.top = span / 2; orthographic.bottom = -span / 2; orthographic.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement); resize()
  function setView(name) {
    const directions = { Top: [0, 1, .001], Bottom: [0, -1, .001], Front: [0, 0, 1], Behind: [0, 0, -1], Left: [-1, 0, 0], Right: [1, 0, 0], Default: [.85, 1, .95], 'Current plate': [.85, 1, .95] }
    camera.position.copy(center).add(new THREE.Vector3(...(directions[name] || directions.Default)).normalize().multiplyScalar(span * 1.9)); orbit.target.copy(center); orbit.update()
  }
  function setPerspective(enabled) {
    const next = enabled ? perspective : orthographic
    next.position.copy(camera.position); next.quaternion.copy(camera.quaternion); camera = next; orbit.object = camera; orbit.update(); resize()
  }
  const ray = new THREE.Raycaster()
  function pick(event) {
    const rect = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera)
    const hit = ray.intersectObject(paths)[0]
    return hit ? sourceIndexes[hit.instanceId] : null
  }
  let animation
  function draw() { animation = requestAnimationFrame(draw); orbit.update(); renderer.render(scene, camera) }
  draw()
  return { update, setView, setPerspective, pick, dispose() {
    cancelAnimationFrame(animation); observer.disconnect(); orbit.dispose()
    paths.geometry.dispose(); material.dispose(); shellMaterial.dispose(); lineGeometry.dispose(); travel.material.dispose()
    markerGeometry.dispose(); markers.material.dispose()
    bed.geometry.dispose(); bed.material.dispose(); grid.geometry.dispose(); grid.material.dispose(); nozzle.geometry.dispose(); nozzle.material.dispose(); renderer.dispose()
  } }
}
