// Real browser/WASM/worker checks, independent of backend services.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage()
  await page.goto(process.env.PRINTHUB_TEST_URL || 'http://127.0.0.1:5174')
  const checks = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { fromGeometry, modelMesh, exportPlate3mf, runModelAction, validatePlate } = await import('/src/workspaceTools.js')
    const { placeMeshOnFace } = await import('/src/SlicerWorkspace.jsx')
    const { arrangeModels, loadStlFiles } = await import('/src/slicerModelUtils.js')
    const { unzipSync, strFromU8 } = await import('/node_modules/.vite/deps/fflate.js')
    const { encodeProject, decodeProject } = await import('/src/projectStore.js')
    const checks = []
    function check(condition, name) { if (!condition) throw new Error(name); checks.push(name) }
    const plate = { originX: 0, originY: 0, width: 200, depth: 200, height: 200, exclusions: [[{ x: 80, y: 80 }, { x: 120, y: 120 }]] }
    const a = fromGeometry(new THREE.BoxGeometry(20, 30, 40), 'cube A', { x: 100, y: 100, z: 20 })
    const b = { ...a, id: crypto.randomUUID(), name: 'cube B', rotation: { x: 90, y: 0, z: 45 } }
    const oriented = modelMesh({ ...b, scaleVector: { x: 2, y: 1, z: .5 } })
    placeMeshOnFace(oriented, { face: { normal: new THREE.Vector3(1, 0, 0) } })
    const normal = new THREE.Vector3(1, 0, 0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(oriented.matrixWorld))
    check(Math.abs(new THREE.Box3().setFromObject(oriented).min.z) < .001 && normal.z < -.999, 'Place on Face uses printer Z-up and handles nonuniform scaling')
    const arranged = arrangeModels([a, b], plate)
    check(validatePlate(arranged, plate).length === 0, 'Arrange respects arbitrary rotation and exclusion zones')
    let refused = false
    try { arrangeModels([fromGeometry(new THREE.BoxGeometry(300, 20, 20), 'Too large')], plate) } catch { refused = true }
    check(refused, 'Arrange rejects impossible placement instead of overlapping objects')
    a.painting = { 0: { support: 1, seam: 2 } }
    a.layerRanges = [{ min: 0, max: 5, settings: { layer_height: '.12' } }]
    const hidden = { ...b, visible: false }
    const file = exportPlate3mf([a, hidden])
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const settings = strFromU8(files['Metadata/model_settings.config'])
    check((settings.match(/<model_instance>/g) || []).length === 1 && !settings.includes('value="4"'), '3MF excludes hidden model references')
    const xml = strFromU8(files['3D/3dmodel.model'])
    check(xml.includes('paint_supports="4"') && xml.includes('paint_seam="8"') && Boolean(files['Metadata/layer_config_ranges.xml']), '3MF preserves painted faces and variable-layer settings')
    const imported = await loadStlFiles([file], { ...plate, exclusions: [] })
    check(imported.length === 1 && Math.abs(imported[0].dimensions.z - 40) < .001, 'Native 3MF export reimports as valid geometry')
    const restored = await decodeProject(encodeProject({ models: [a], plates: [{ id: 'plate-1' }] }))
    check(restored.models[0].geometry.attributes.position.count === a.geometry.attributes.position.count && restored.models[0].painting[0].seam === 2, 'Project round trip preserves geometry and painting')
    const cut = await runModelAction('cut', [a], [a.id], plate, { axis: 'z', at: 20 })
    check(cut.models.length === 2 && cut.models.every(m => Math.abs(m.dimensions.z - 20) < .01), 'Cut creates two real capped meshes')
    const assembled = await runModelAction('assembly', [a, { ...b, position: { x: 150, y: 100, z: 20 } }], [a.id, b.id], plate)
    const split = await runModelAction('split', assembled.models, assembled.selectedIds, plate)
    check(split.models.length === 2, 'Assembly and disconnected-shell splitting operate on geometry')
    const overlap = { ...a, id: crypto.randomUUID(), position: { x: 110, y: 100, z: 20 } }
    const union = await runModelAction('meshboolean', [a, overlap], [a.id, overlap.id], plate, { operation: 'union' })
    check(union.models.length === 1 && Math.abs(union.models[0].dimensions.x - 30) < .01, 'Boolean union produces a larger watertight mesh')
    const text = await runModelAction('text', [], [], plate, { text: 'Test', size: 8, depth: 2 })
    check(text.models[0].geometry.attributes.position.count > 100, 'Text tool generates actual extruded geometry')
    const parsed = await new Promise((resolve, reject) => {
      const worker = new Worker('/src/gcodeWorker.js', { type: 'module' })
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Parser timeout')) }, 10000)
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)) }
      worker.onmessage = ({ data }) => {
        if (data.type === 'error') { clearTimeout(timer); worker.terminate(); reject(new Error(data.message)) }
        if (data.type === 'complete') { clearTimeout(timer); worker.terminate(); resolve(data) }
      }
      worker.postMessage({ type: 'parse', source: ';LAYER_CHANGE\n;Z:0.2\n;HEIGHT:0.2\n;TYPE:Outer wall\nG90\nM83\nG1 X10 Y10 Z0.2 F1200\nM106 S128\nG2 X30 Y10 I10 J0 E4\nG1 Z1\nG1 Z0.2\nG1 X30 Y20 E1\n;LAYER_CHANGE\n;Z:0.4\nG1 Z0.4\nG1 X10 Y20 E1\n; estimated printing time (normal mode) = 1m 2s' })
    })
    check(parsed.layers.length === 2, 'G-code parser avoids phantom layers and Z-hop layers')
    check(parsed.moves.line.length > 20 && Math.abs(parsed.footer.totalTime - 62) < .01, 'G-code parser tessellates real arcs and reads Orca duration')
    check(Math.max(...parsed.moves.fan) > 49 && Math.max(...parsed.moves.fan) < 51, 'Fan heatmap uses percentage rather than raw PWM')
    return checks
  })
  checks.forEach(name => console.log(`PASS ${name}`))
  assert(checks.length >= 12)
  if (process.env.PRINTHUB_STEP_FIXTURE) {
    const source = (await readFile(process.env.PRINTHUB_STEP_FIXTURE)).toString('base64')
    const count = await page.evaluate(async source => {
      const { parseModelFile } = await import('/src/modelFormats.js')
      const file = new File([Uint8Array.from(atob(source), c => c.charCodeAt(0))], 'fixture.step')
      const models = await parseModelFile(file)
      return models.reduce((sum, m) => sum + m.geometry.attributes.position.count, 0)
    }, source)
    assert(count > 0)
    console.log(`PASS actual STEP import through local OpenCascade WASM (${count} vertices)`)
  }
} finally { await browser.close() }
