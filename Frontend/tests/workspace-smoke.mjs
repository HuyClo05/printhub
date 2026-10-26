// Browser checks use a mocked API and never start a physical print.
// Run against Vite: PRINTHUB_TEST_URL=http://127.0.0.1:5174 node tests/workspace-smoke.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const settings = { printers: { name: 'Voron Trident', type: 'machine', printable_area: ['0x0', '250x0', '250x250', '0x250'], printable_height: '250', nozzle_diameter: ['0.4'] }, presets: { name: 'Quality @Voron', type: 'process', layer_height: '0.2', wall_loops: '2' }, filaments: { name: 'PLA', type: 'filament', filament_type: ['PLA'] } }
let profiles = Object.entries(settings).map(([category, value], i) => ({ id: `version-${i}`, category, name: value.name, version: 1, settings: value, created_at: '2026-10-18T00:00:00Z' }))
const completed = { id: 'job-complete', file_id: 'file-a', name: 'Stored cube.stl', status: 'completed', printer_profile: 'Voron Trident', process_profile: 'Quality @Voron', filament_profile: 'PLA', attempt_count: 1, max_attempts: 5, print_time_seconds: 60, created_at: '2026-10-18T00:00:00Z' }
let failed = { ...completed, id: 'job-failed', name: 'Failed cube.stl', status: 'dead-lettered', error_message: 'Example preset error', attempt_count: 5 }
const calls = []
let sliceRequest = null
await page.addInitScript(() => {
  const claims = { sub: 'workspace-test-owner', email: 'test@example.test', exp: Math.floor(Date.now() / 1000) + 3600 }
  localStorage.setItem('printhub.accessToken', `test.${btoa(JSON.stringify(claims))}.signature`)
  localStorage.setItem('printhub.user', JSON.stringify(claims))
})
await page.route('**/health/**', route => route.fulfill({ json: { status: 'ok' } }))
await page.route('http://upload.test/model', route => route.fulfill({ status: 200, body: '' }))
await page.route('**/api/v1/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '')
  calls.push(`${request.method()} ${path}`)
  if (path === '/profiles' && request.method() === 'POST') {
    const input = request.postDataJSON(), row = { ...input, id: `saved-${profiles.length}`, version: 2, created_at: '2026-10-18T01:00:00Z' }
    profiles.push(row); settings[input.category] = input.settings
    return route.fulfill({ status: 201, json: row })
  }
  if (path === '/profiles') return route.fulfill({ json: profiles })
  if (path.startsWith('/profiles/')) return route.fulfill({ json: profiles.find(p => p.id === path.split('/').at(-1)) })
  const match = path.match(/^\/slicer\/profiles\/(printers|presets|filaments)(?:\/(.*))?$/)
  if (match) return route.fulfill({ json: match[2] ? { settings: settings[match[1]] } : { profiles: [settings[match[1]].name] } })
  if (path === '/files/upload-url' && request.method() === 'POST') return route.fulfill({ status: 201, json: { file_id: 'uploaded-file', upload_url: 'http://upload.test/model', method: 'PUT', expires_at: '2026-10-18T01:00:00Z' } })
  if (path === '/files/uploaded-file/complete' && request.method() === 'POST') return route.fulfill({ json: { id: 'uploaded-file', name: 'plate.3mf', status: 'ready' } })
  if (path === '/slice-jobs' && request.method() === 'POST') { sliceRequest = request.postDataJSON(); return route.fulfill({ status: 202, json: { ...completed, id: 'new-slice', file_id: 'uploaded-file', status: 'completed' } }) }
  if (path === '/slice-jobs') return route.fulfill({ json: [completed, failed] })
  if (path.endsWith('/retry')) { failed = { ...failed, status: 'queued', attempt_count: 0, error_message: null }; return route.fulfill({ json: failed }) }
  if (path.endsWith('/cancel')) { failed = { ...failed, status: 'cancelled' }; return route.fulfill({ json: failed }) }
  if (path.endsWith('/gcode')) return route.fulfill({ contentType: 'text/plain', body: ';LAYER_CHANGE\n;Z:0.2\n;HEIGHT:0.2\n;WIDTH:0.4\n;TYPE:Outer wall\nG90\nM83\nG1 X110 Y110 Z0.2 F1200\nG1 X120 Y110 E1\nG1 X120 Y120 E1\nG1 X110 Y110 E1\n' })
  if (path.startsWith('/slice-jobs/')) return route.fulfill({ json: path.includes('job-failed') ? failed : { ...completed, id: path.split('/')[2] } })
  if (path === '/files' || path === '/printers') return route.fulfill({ json: [] })
  return route.fulfill({ status: 404, json: { detail: path } })
})
try {
  await page.goto(process.env.PRINTHUB_TEST_URL || 'http://127.0.0.1:5174')
  await page.getByRole('button', { name: 'Prepare', exact: true }).waitFor()
  const stl = 'solid tetra\n' + [
    [[0, 0, 0], [10, 0, 0], [0, 10, 0]],
    [[0, 0, 0], [0, 0, 10], [10, 0, 0]],
    [[0, 0, 0], [0, 10, 0], [0, 0, 10]],
    [[10, 0, 0], [0, 0, 10], [0, 10, 0]]
  ].map(vertices => `facet normal 0 0 1\nouter loop\n${vertices.map(v => `vertex ${v.join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n') + '\nendsolid tetra'
  await page.locator('#model-file-input').setInputFiles({ name: 'tetra.stl', mimeType: 'model/stl', buffer: Buffer.from(stl) })
  await page.waitForFunction(() => document.querySelectorAll('.object-row').length === 1)
  await page.locator('body').click({ position: { x: 1400, y: 500 } })
  await page.locator('.object-row').click()
  await page.locator('.build-plate-wrap').focus()
  await page.keyboard.press('Control+d')
  await page.waitForFunction(() => document.querySelectorAll('.object-row').length === 2)
  console.log('PASS Ctrl+D duplicates without deleting the original')
  await page.keyboard.press('Delete')
  assert.equal(await page.locator('.object-row').count(), 2)
  assert.equal(await page.getByRole('button', { name: /Remove instance/ }).count(), 0)
  console.log('PASS deletion is available only from each object-list remove button')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.object-row').length === 1)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.object-row').length === 2)
  console.log('PASS undo and redo')
  await page.locator('.object-row').nth(0).click()
  await page.locator('.object-row').nth(1).click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Move, M', exact: true }).click()
  await page.getByText('Transforming 2 selected objects from the primary object.').waitFor()
  const xInput = page.locator('.transform-popover.translate .axis-inputs input').first()
  const targetX = Number(await xInput.inputValue()) + 7
  await xInput.fill(String(targetX))
  await page.locator('.transform-popover.translate').getByRole('button', { name: 'Done' }).click()
  console.log('PASS numeric transforms apply to the complete multi-selection')
  await page.waitForFunction(() => document.querySelector('.app-project-title')?.textContent.includes('Autosaved'))
  await page.reload()
  await page.waitForFunction(() => document.querySelectorAll('.object-row').length === 2)
  console.log('PASS account-specific autosave restores geometry and objects')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  const download = await downloadPromise
  assert(download.suggestedFilename().endsWith('.printhub'))
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'))
  assert.equal(Math.round(exported.models[0].position.x), Math.round(targetX))
  assert.equal(Math.round(exported.models[1].position.x - exported.models[0].position.x), 10)
  console.log('PASS project file export')
  await page.locator('.app-menu summary').click()
  const plateDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export plate 3MF', exact: true }).click()
  const plateDownload = await plateDownloadPromise
  assert.equal(plateDownload.suggestedFilename(), 'printhub-plate.3mf')
  console.log('PASS lazy-loaded plate 3MF export')
  await page.getByRole('button', { name: 'Advanced process options', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'presets preset editor' })
  await editor.getByRole('searchbox').fill('layer_height')
  await editor.locator('.editable-setting input').fill('0.16')
  await editor.getByRole('button', { name: 'Save new version & apply' }).click()
  await editor.waitFor({ state: 'detached' })
  assert.equal(settings.presets.layer_height, '0.16')
  console.log('PASS preset editing saves and applies an immutable version')
  await page.getByRole('button', { name: '+', exact: true }).click()
  await page.getByRole('button', { name: 'Flush volumes', exact: true }).click()
  const flush = page.getByRole('dialog', { name: 'Flush volumes' })
  await flush.getByLabel('Flush PLA to PLA').nth(1).fill('155')
  await flush.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('button', { name: 'Slice plate', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.preview-canvas-shell canvas'))
  assert.equal(sliceRequest.process_overrides.flush_volumes_matrix[1], '155')
  assert(calls.includes('POST /files/upload-url'))
  assert(calls.includes('POST /files/uploaded-file/complete'))
  assert(calls.includes('POST /slice-jobs'))
  console.log('PASS signed upload, flush settings, slicing request, and G-code preview workflow')
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await page.getByRole('heading', { name: 'Projects & jobs' }).waitFor()
  await page.getByText('Stored cube.stl', { exact: true }).waitFor()
  await page.getByText('Failed cube.stl', { exact: true }).waitFor()
  assert.equal(await page.locator('.preset-panel').count(), 0)
  console.log('PASS job history displays completed and failed jobs across the full workspace')
  await page.locator('tr', { hasText: 'Stored cube.stl' }).getByRole('button', { name: 'Open', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.preview-canvas-shell canvas'))
  console.log('PASS opening historical G-code')
  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`)
  console.log('PASS no browser runtime errors')
} catch (error) {
  console.error('Browser errors:', errors)
  console.error((await page.locator('body').innerText()).slice(-2200))
  throw error
} finally { await browser.close() }
