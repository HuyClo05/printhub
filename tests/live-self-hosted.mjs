// Destructive only to its dedicated simulator records; never contacts a physical printer.
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const baseUrl = process.env.PRINTHUB_TEST_URL || 'http://localhost:8080'
const bundlePath = process.env.PRINTHUB_PROFILE_BUNDLE || '/home/huyv/Downloads/Voron Trident 250 0.4 nozzle - Huy Vo.orca_printer'
const modelPath = process.env.PRINTHUB_MODEL || '/home/huyv/Downloads/3dbenchy.stl'
const username = 'printhub-e2e'
const email = 'printhub-e2e@local.invalid'
const password = `E2e-${randomBytes(18).toString('base64url')}!`
const runId = Date.now()
const env = Object.fromEntries((await readFile(resolve(root, '.ph_env'), 'utf8')).split(/\r?\n/).flatMap(line => {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
  return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : []
}))
const dbName = env.POSTGRES_DB || 'printhub'
const dbUser = env.POSTGRES_USER || 'printhub'
const sha256 = value => createHash('sha256').update(value).digest('hex')
const command = (program, args, options = {}) => execFileSync(program, args, { cwd: root, encoding: 'utf8', ...options }).trim()
const podman = (...args) => command('podman', args)
const kcadmConfig = '/tmp/printhub-e2e-kcadm.config'
let workerStopped = false
let agentProcess = null
let agentOutput = ''
let tempDirectory = null
let browser = null
let page = null

function kcadm(...args) {
  return podman('exec', 'printhub_keycloak_1', '/opt/keycloak/bin/kcadm.sh', ...args, '--config', kcadmConfig)
}

function ensureTestUser() {
  try {
    kcadm('config', 'credentials', '--server', 'http://127.0.0.1:8080', '--realm', 'master', '--user', env.KEYCLOAK_ADMIN || 'admin', '--password', env.KEYCLOAK_ADMIN_PASSWORD || 'change-me')
  } catch {
    throw new Error('Could not authenticate the Keycloak admin account from .ph_env')
  }
  let users = JSON.parse(kcadm('get', 'users', '-r', 'printhub', '-q', `username=${username}`) || '[]')
  if (!users.some(user => user.username === username)) {
    kcadm('create', 'users', '-r', 'printhub', '-s', `username=${username}`, '-s', `email=${email}`, '-s', 'firstName=PrintHub', '-s', 'lastName=E2E', '-s', 'enabled=true', '-s', 'emailVerified=true')
    users = JSON.parse(kcadm('get', 'users', '-r', 'printhub', '-q', `username=${username}`) || '[]')
  }
  const user = users.find(row => row.username === username)
  assert(user, 'Keycloak test user was not created')
  kcadm('update', `users/${user.id}`, '-r', 'printhub', '-s', 'enabled=true', '-s', 'emailVerified=true', '-s', `email=${email}`, '-s', 'firstName=PrintHub', '-s', 'lastName=E2E', '-s', 'requiredActions=[]')
  kcadm('set-password', '-r', 'printhub', '--username', username, '--new-password', password, '--temporary=false')
}

async function waitFor(load, accept, label, timeout = 120_000) {
  const deadline = Date.now() + timeout
  let value
  while (Date.now() < deadline) {
    value = await load()
    if (accept(value)) return value
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`${label} timed out; last result: ${JSON.stringify(value)}`)
}

function psql(sql) {
  return podman('exec', 'printhub_postgres_1', 'psql', '-X', '-q', '-t', '-A', '-U', dbUser, '-d', dbName, '-c', sql)
}

try {
  ensureTestUser()
  const authRequests = []
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  const browserErrors = []
  page.on('request', request => {
    if (request.url().includes('/protocol/openid-connect/')) authRequests.push({ url: request.url(), method: request.method(), body: request.postData() || '' })
  })
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto(baseUrl)
  await page.getByRole('button', { name: 'Continue to Keycloak' }).click()
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  await page.getByRole('button', { name: 'Prepare', exact: true }).waitFor({ timeout: 60_000 })

  const authorization = authRequests.find(request => request.url.includes('/auth?'))
  const tokenRequest = authRequests.find(request => request.url.includes('/token') && request.method === 'POST')
  assert.equal(new URL(authorization.url).searchParams.get('code_challenge_method'), 'S256')
  assert(new URL(authorization.url).searchParams.get('code_challenge'))
  assert.match(tokenRequest.body, /grant_type=authorization_code/)
  assert.match(tokenRequest.body, /code_verifier=/)
  const token = await page.evaluate(() => localStorage.getItem('printhub.accessToken'))
  assert(token, 'Keycloak did not return an access token')

  async function api(path, options = {}) {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${baseUrl}/api/v1${path}`, { ...options, headers })
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} returned ${response.status}: ${await response.text()}`)
    return response
  }
  async function apiJson(path, options) { return (await api(path, options)).json() }

  const me = await apiJson('/me')
  assert.equal(me.email, email)
  assert.equal(me.issuer, `${baseUrl}/realms/printhub`)
  console.log('PASS real Keycloak Authorization Code + PKCE login')

  const bundle = await readFile(bundlePath)
  const form = new FormData()
  form.append('bundle', new Blob([bundle]), basename(bundlePath))
  const imported = await apiJson('/slicer/profile-bundles', { method: 'POST', body: form })
  assert(imported.printers[0] && imported.presets[0] && imported.filaments[0], 'Profile bundle did not contain a complete slicing profile set')
  await page.reload()
  await page.getByRole('button', { name: 'Prepare', exact: true }).waitFor()
  await page.locator('#model-file-input').setInputFiles(modelPath)
  await page.locator('.object-row').waitFor({ timeout: 60_000 })
  const signedResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/files/upload-url') && response.request().method() === 'POST')
  const objectResponse = page.waitForResponse(response => response.url().includes('/printhub-artifacts/') && response.request().method() === 'PUT')
  const completeResponse = page.waitForResponse(response => /\/api\/v1\/files\/[^/]+\/complete$/.test(new URL(response.url()).pathname))
  const jobResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/slice-jobs') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Slice plate', exact: true }).click()
  const signed = await (await signedResponse).json()
  assert(new URL(signed.upload_url).pathname.startsWith('/printhub-artifacts/'))
  assert((await objectResponse).ok(), 'Browser-to-SeaweedFS upload failed')
  const storedModel = await (await completeResponse).json()
  assert.match(storedModel.sha256, /^[a-f0-9]{64}$/)
  console.log('PASS signed direct upload to SeaweedFS')

  const created = await (await jobResponse).json()
  const createJob = () => apiJson('/slice-jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ file_id: created.file_id, printer_profile: created.printer_profile, process_profile: created.process_profile, filament_profile: created.filament_profile, arrange: false, orient: false }),
  })
  const completed = await waitFor(
    () => apiJson(`/slice-jobs/${created.id}`),
    job => ['completed', 'failed', 'dead-lettered'].includes(job.status),
    'Native OrcaSlicer job',
    15 * 60_000,
  )
  assert.equal(completed.status, 'completed', completed.error_message || `Slice ended as ${completed.status}`)
  assert.equal(completed.attempt_count, 1)

  const row = JSON.parse(psql(`SELECT json_build_object('task_id',t.id,'attempt_count',t.attempt_count,'started_at',t.started_at,'gcode_key',t.gcode_key,'gcode_sha256',t.gcode_sha256,'model_key',f.stl_url)::text FROM print_jobs j JOIN print_tasks t ON t.job_id=j.id JOIN stl_files f ON f.id=t.file_id WHERE j.id='${created.id}';`))
  assert.equal(row.attempt_count, 1)
  assert(row.started_at && row.gcode_key && row.gcode_sha256)
  console.log('PASS PostgreSQL worker queue claim')

  const gcodeResponse = await api(`/slice-jobs/${created.id}/gcode`)
  const gcode = Buffer.from(await gcodeResponse.arrayBuffer())
  assert.equal(sha256(gcode), completed.gcode_sha256)
  assert.match(gcode.toString('utf8', 0, Math.min(gcode.length, 100_000)), /OrcaSlicer/i)
  console.log('PASS native OrcaSlicer execution and checksummed G-code storage')

  await page.getByRole('heading', { name: 'G-code preview' }).waitFor({ timeout: 120_000 })
  await page.locator('.preview-canvas-shell canvas').waitFor()
  console.log('PASS stored G-code loads in the frontend preview')

  podman('stop', 'printhub_worker_1')
  workerStopped = true
  const cancelledJob = await createJob()
  const cancelled = await apiJson(`/slice-jobs/${cancelledJob.id}/cancel`, { method: 'POST' })
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(psql(`SELECT status FROM print_tasks WHERE job_id='${cancelledJob.id}';`), 'cancelled')
  podman('start', 'printhub_worker_1')
  workerStopped = false
  await new Promise(resolve => setTimeout(resolve, 3000))
  assert.equal((await apiJson(`/slice-jobs/${cancelledJob.id}`)).status, 'cancelled')
  console.log('PASS durable slice cancellation')

  const printer = await apiJson('/printers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `E2E simulator ${runId}`, model: 'PrintHub simulator', host_type: 'simulator', profile_name: created.printer_profile }),
  })
  const pairing = await apiJson(`/printers/${printer.id}/pair`, { method: 'POST' })
  tempDirectory = await mkdtemp(resolve(tmpdir(), 'printhub-e2e-agent-'))
  const configPath = resolve(tempDirectory, 'agent.json')
  agentProcess = spawn(resolve(root, '.ph_venv/bin/python'), ['-m', 'app.printer_agent', '--server', baseUrl, '--pair', pairing.code, '--config', configPath], { cwd: resolve(root, 'Backend'), stdio: ['ignore', 'pipe', 'pipe'] })
  agentProcess.stdout.on('data', chunk => { agentOutput += chunk })
  agentProcess.stderr.on('data', chunk => { agentOutput += chunk })
  await waitFor(
    async () => (await apiJson('/printers')).find(item => item.id === printer.id),
    item => item?.state === 'ready' && item.paired,
    'Simulator agent pairing',
    45_000,
  )
  const printCommand = await apiJson(`/printers/${printer.id}/commands`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'print', job_id: created.id }),
  })
  await waitFor(
    () => apiJson(`/printers/${printer.id}/commands`),
    commands => commands.find(item => item.id === printCommand.id)?.status === 'completed',
    'Simulator print command',
    45_000,
  )
  await waitFor(
    async () => (await apiJson('/printers')).find(item => item.id === printer.id),
    item => item?.state === 'printing',
    'Simulator printing heartbeat',
    45_000,
  )
  const stopCommand = await apiJson(`/printers/${printer.id}/commands`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }),
  })
  await waitFor(
    () => apiJson(`/printers/${printer.id}/commands`),
    commands => commands.find(item => item.id === stopCommand.id)?.status === 'completed',
    'Simulator stop command',
    45_000,
  )
  await waitFor(
    async () => (await apiJson('/printers')).find(item => item.id === printer.id),
    item => item?.state === 'ready',
    'Simulator ready heartbeat',
    45_000,
  )
  await api(`/printers/${printer.id}`, { method: 'DELETE' })
  assert.deepEqual(browserErrors, [], `Browser runtime errors: ${browserErrors.join('; ')}`)
  console.log('PASS real printer-agent delivery to the safe simulator')
  console.log(`Authenticated live verification complete: job ${created.id}`)
} catch (error) {
  if (agentOutput) console.error(agentOutput.slice(-3000))
  if (page) console.error(`Browser stopped at ${page.url()}\n${(await page.locator('body').innerText().catch(() => '')).slice(-2000)}`)
  throw error
} finally {
  if (workerStopped) {
    try { podman('start', 'printhub_worker_1') } catch {}
  }
  if (agentProcess && agentProcess.exitCode === null) {
    agentProcess.kill('SIGINT')
    await Promise.race([new Promise(resolve => agentProcess.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))])
    if (agentProcess.exitCode === null) agentProcess.kill('SIGKILL')
  }
  if (browser) await browser.close()
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true })
}
