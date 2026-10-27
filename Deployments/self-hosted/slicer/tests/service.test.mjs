import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { chmod } from 'node:fs/promises'
import test from 'node:test'

test('private slicer preserves preset inheritance, 3MF, statistics and cancellation', { timeout: 20000 }, async () => {
  const binary = fileURLToPath(new URL('./fake-orca.mjs', import.meta.url))
  await chmod(binary, 0o755)
  const server = spawn(process.execPath, ['printhub-server.mjs'], { env: { ...process.env, PORT: '3097', ORCASLICER_PATH: binary, ORCASLICER_PROFILES: fileURLToPath(new URL('./fixtures', import.meta.url)) }, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  server.stderr.on('data', data => { logs += data })
  const ready = new Promise((resolve, reject) => { server.stdout.on('data', data => { if (data.toString().includes('ready with')) resolve() }); server.on('error', reject); server.on('exit', code => reject(new Error(`Service exited ${code}: ${logs}`))) })
  const base = 'http://127.0.0.1:3097'
  function request(name = 'Custom machine', requestId = 'test') {
    const form = new FormData()
    form.set('file', new Blob(['test model']), 'plate.3mf')
    for (const [field, settings] of Object.entries({ printerProfile: { type: 'machine', name, inherits: 'Test machine' }, presetProfile: { type: 'process', name: 'Custom process', inherits: 'Test process', layer_height: '0.16' }, filamentProfile: { _printhub_filaments: [{ type: 'filament', name: 'PLA1', inherits: 'Test filament' }, { type: 'filament', name: 'PLA2', inherits: 'Test filament' }] } })) form.set(field, new Blob([JSON.stringify(settings)]), `${field}.json`)
    form.set('requestId', requestId)
    return fetch(`${base}/slice`, { method: 'POST', body: form })
  }
  try {
    await ready
    assert.deepEqual(await (await fetch(`${base}/profiles/printers`)).json(), ['Test machine'])
    const resolved = await (await fetch(`${base}/profiles/presets/${encodeURIComponent('Test process child')}`)).json()
    assert.equal(resolved.layer_height, '0.2')
    assert.equal(resolved.line_width, '0.42')
    assert.equal((await fetch(`${base}/profiles/presets/Missing`)).status, 404)
    const sliced = await request()
    assert.equal(sliced.status, 200, await sliced.clone().text())
    assert.equal(sliced.headers.get('x-print-time-seconds'), '62')
    assert.equal(sliced.headers.get('x-filament-used-g'), '3.4')
    assert((await sliced.text()).includes('G1'))
    const missing = await request('Unknown')
    assert.equal(missing.status, 200)
    const pending = request('Slow machine', 'cancel-me')
    let cancelled = false
    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      const busy = await request()
      if (busy.status !== 503) continue
      cancelled = (await (await fetch(`${base}/slice/cancel-me/cancel`, { method: 'POST' })).json()).cancelled
      if (cancelled) break
    }
    assert(cancelled, 'Native process should be cancellable')
    assert.equal((await pending).status, 422)
  } finally {
    server.kill('SIGTERM')
    if (server.exitCode === null) await once(server, 'exit')
  }
})
