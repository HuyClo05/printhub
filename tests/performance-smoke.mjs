// Verifies loading boundaries against a production preview rather than timing a specific machine.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const baseUrl = process.env.PRINTHUB_TEST_URL || 'http://127.0.0.1:4173'
const stepFixture = process.env.PRINTHUB_STEP_FIXTURE
const forbiddenAtSignIn = [
  'three-core',
  'SlicerWorkspace',
  'GCodeViewer',
  'workspaceTools',
  'slicerModelUtils',
  'open-cascade',
  'csg-tools',
  'mesh-bvh',
  '.wasm',
]

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
})

async function mockApi(page) {
  const settings = {
    printers: { name: 'Voron Trident', type: 'machine', printable_area: ['0x0', '250x0', '250x250', '0x250'], printable_height: '250', nozzle_diameter: ['0.4'] },
    presets: { name: 'Quality @Voron', type: 'process', layer_height: '0.2' },
    filaments: { name: 'PLA', type: 'filament', filament_type: ['PLA'] },
  }
  await page.route('**/health/**', route => route.fulfill({ json: { status: 'ok' } }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const match = path.match(/^\/slicer\/profiles\/(printers|presets|filaments)(?:\/(.*))?$/)
    if (match) return route.fulfill({ json: match[2] ? { settings: settings[match[1]] } : { profiles: [settings[match[1]].name] } })
    if (path === '/profiles' || path === '/files' || path === '/printers' || path === '/slice-jobs') return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { detail: path } })
  })
}

try {
  const signInPage = await browser.newPage()
  const signInResponses = []
  signInPage.on('response', response => signInResponses.push(response.url()))
  await mockApi(signInPage)
  await signInPage.goto(baseUrl, { waitUntil: 'networkidle' })
  await signInPage.getByRole('button', { name: 'Continue to Keycloak' }).waitFor()

  const unexpected = signInResponses.filter(url => forbiddenAtSignIn.some(name => url.includes(name)))
  assert.deepEqual(unexpected, [], `Heavy assets loaded at sign-in: ${unexpected.join(', ')}`)
  const initialJsBytes = await signInPage.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => new URL(entry.name).pathname.endsWith('.js'))
    .reduce((total, entry) => total + (entry.decodedBodySize || entry.transferSize), 0))
  assert(initialJsBytes > 0 && initialJsBytes <= 350_000, `Initial JavaScript is ${initialJsBytes} bytes; budget is 350000`)
  console.log(`PASS sign-in loads ${(initialJsBytes / 1024).toFixed(1)} KiB of JavaScript without 3D/geometry chunks`)
  await signInPage.close()

  const workspacePage = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  const workspaceResponses = []
  const errors = []
  workspacePage.on('response', response => workspaceResponses.push(response.url()))
  workspacePage.on('pageerror', error => errors.push(error.message))
  await workspacePage.addInitScript(() => {
    const claims = { sub: 'performance-test-owner', email: 'performance@example.test', exp: Math.floor(Date.now() / 1000) + 3600 }
    localStorage.setItem('printhub.accessToken', `test.${btoa(JSON.stringify(claims))}.signature`)
    localStorage.setItem('printhub.user', JSON.stringify(claims))
  })
  await mockApi(workspacePage)
  await workspacePage.goto(baseUrl, { waitUntil: 'networkidle' })
  await workspacePage.getByRole('button', { name: 'Prepare', exact: true }).waitFor()

  assert(workspaceResponses.some(url => url.includes('SlicerWorkspace')), 'Workspace chunk did not load after authentication')
  assert(workspaceResponses.some(url => url.includes('three-core')), 'Three.js did not load with the workspace')
  assert(!workspaceResponses.some(url => url.includes('open-cascade') || url.includes('.wasm')), 'OpenCascade loaded before a STEP import')
  console.log('PASS authenticated workspace loads Three.js but defers OpenCascade/WASM')

  if (stepFixture) {
    const responseCountBeforeImport = workspaceResponses.length
    await workspacePage.locator('#model-file-input').setInputFiles(stepFixture)
    await workspacePage.waitForFunction(() => document.querySelectorAll('.object-row').length > 0, null, { timeout: 60_000 })
    const importResponses = workspaceResponses.slice(responseCountBeforeImport)
    assert(importResponses.some(url => url.includes('open-cascade') || url.includes('.wasm')), 'STEP import did not load OpenCascade/WASM')
    console.log('PASS STEP import loads OpenCascade/WASM only on demand')
  } else {
    console.log('SKIP STEP on-demand check (set PRINTHUB_STEP_FIXTURE to a .step file)')
  }

  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`)
  await workspacePage.close()
} finally {
  await browser.close()
}
