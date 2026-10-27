// Private headless Orca HTTP service. Each request uses its own profiles,
// filesystem and CLI process. No arguments are passed through a shell.
import express from 'express'
import multer from 'multer'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 4, fileSize: 60 * 1024 * 1024, fields: 12 } })
const binary = process.env.ORCASLICER_PATH || '/opt/orcaslicer/squashfs-root/AppRun'
const resources = process.env.ORCASLICER_PROFILES || '/opt/orcaslicer/squashfs-root/resources/profiles'
const profileIndex = new Map()
// Vendors ship same-named bases (e.g. fdm_process_common), so parents resolve within the vendor first.
const vendorIndex = new Map()
const vendorOf = new WeakMap()
async function indexProfiles(directory, vendor = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await indexProfiles(file, vendor || entry.name)
    else if (entry.name.endsWith('.json')) {
      try { const profile = JSON.parse(await fs.readFile(file, 'utf8')); if (profile.type && profile.name) { profileIndex.set(`${profile.type}/${profile.name}`, profile); vendorIndex.set(`${vendor}/${profile.type}/${profile.name}`, profile); vendorOf.set(profile, vendor) } } catch {}
    }
  }
}
await indexProfiles(resources)
function resolveProfile(type, name, vendor, depth = 0) {
  const profile = vendorIndex.get(`${vendor}/${type}/${name}`) || profileIndex.get(`${type}/${name}`)
  if (!profile || depth > 16) return null
  const parent = profile.inherits ? resolveProfile(type, profile.inherits, vendorOf.get(profile), depth + 1) : null
  return { ...parent, ...profile }
}
function validateProfile(profile, type) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error(`Invalid ${type} profile JSON`)
  if (profile.type !== type) throw new Error(`Expected a ${type} profile, received ${profile.type || 'an untyped profile'}`)
  return profile
}
let active = false
const processes = new Map()
app.post('/slice/:id/cancel', (req, res) => {
  const child = processes.get(req.params.id)
  if (child) child.kill('SIGTERM')
  res.json({ cancelled: Boolean(child) })
})
app.get('/health', (_req, res) => res.json({ status: 'ok', presets: profileIndex.size }))
app.get('/profiles/:category', async (req, res) => {
  const type = { printers: 'machine', presets: 'process', filaments: 'filament' }[req.params.category]
  if (!type) return res.status(404).json({ message: 'Unknown profile category' })
  res.json([...profileIndex.values()].filter(p => p.type === type && p.instantiation !== 'false').map(p => p.name).sort())
})
app.get('/profiles/:category/:name', (req, res) => {
  const type = { printers: 'machine', presets: 'process', filaments: 'filament' }[req.params.category]
  if (!type) return res.status(404).json({ message: 'Unknown profile category' })
  const profile = resolveProfile(type, req.params.name)
  if (!profile) return res.status(404).json({ message: 'Profile not found' })
  res.json(profile)
})
app.post('/slice', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'printerProfile', maxCount: 1 }, { name: 'presetProfile', maxCount: 1 }, { name: 'filamentProfile', maxCount: 1 }]), async (req, res) => {
  if (active) return res.status(503).json({ message: 'Slicer is busy; this job will retry' })
  active = true
  let directory
  try {
    const file = req.files.file?.[0]
    if (!file || !/\.(stl|3mf)$/i.test(file.originalname)) return res.status(400).json({ message: 'Upload a prepared STL or 3MF model' })
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'printhub-slice-'))
    const input = path.join(directory, `model${path.extname(file.originalname).toLowerCase()}`), output = path.join(directory, 'output')
    await fs.mkdir(output); await fs.writeFile(input, file.buffer)
    function parse(field, type) {
      if (!req.files[field]?.[0]) throw new Error(`Missing ${field}`)
      return JSON.parse(req.files[field][0].buffer.toString('utf8'))
    }
    const machine = validateProfile(parse('printerProfile'), 'machine')
    if (req.body.calibrationKind === 'Retraction') machine.use_firmware_retraction = '1'
    const process = validateProfile(parse('presetProfile'), 'process')
    const filamentData = parse('filamentProfile')
    const filaments = (filamentData._printhub_filaments || [filamentData]).map(p => validateProfile(p, 'filament'))
    const printerFile = path.join(directory, 'printer.json'), processFile = path.join(directory, 'process.json')
    await fs.writeFile(printerFile, JSON.stringify(machine)); await fs.writeFile(processFile, JSON.stringify(process))
    const filamentFiles = []
    for (let i = 0; i < filaments.length; i++) { const file = path.join(directory, `filament-${i}.json`); await fs.writeFile(file, JSON.stringify(filaments[i])); filamentFiles.push(file) }
    const args = ['--debug', '3', '--slice', '1', '--load-settings', `${printerFile};${processFile}`, '--load-filaments', filamentFiles.join(';'), '--allow-newer-file', '--outputdir', output]
    if (req.body.arrange === 'true') args.push('--arrange', '1')
    // Orientation is exclusively controlled by the browser's manual tools.
    args.push(input)
    try {
      const running = execute(binary, args, { timeout: 900000, maxBuffer: 8 * 1024 * 1024 })
      if (req.body.requestId) processes.set(req.body.requestId, running.child)
      await running
    } catch (error) {
      const diagnostic = `${error.stdout || ''}\n${error.stderr || ''}`
      let resultError = ''
      try { resultError = JSON.parse(await fs.readFile(path.join(output, 'result.json'), 'utf8')).error_string || '' } catch {}
      const useful = resultError || diagnostic.split(/\r?\n/).filter(line => /\berror\b|unsupported|failed:|can not|not compatible|invalid|missing/i.test(line)).slice(-8).join('\n')
      console.error('Orca CLI failed:', useful || diagnostic.slice(-3000))
      return res.status(422).json({ message: useful || 'OrcaSlicer failed to slice this model', details: diagnostic.slice(-4000) })
    }
    const outputs = (await fs.readdir(output)).filter(name => name.toLowerCase().endsWith('.gcode'))
    if (outputs.length !== 1) throw new Error(`Expected one sliced plate, received ${outputs.length} G-code files`)
    const content = await fs.readFile(path.join(output, outputs[0]))
    const text = content.toString('utf8')
    const time = text.match(/estimated printing time \(normal mode\)\s*=\s*(.*)/i)
    if (time) { let seconds = 0; for (const match of time[1].matchAll(/([\d.]+)\s*([dhms])/g)) seconds += Number(match[1]) * { d: 86400, h: 3600, m: 60, s: 1 }[match[2]]; res.setHeader('x-print-time-seconds', String(seconds)) }
    for (const [unit, header] of [['g', 'x-filament-used-g'], ['mm', 'x-filament-used-mm']]) { const match = text.match(new RegExp(`filament used \\[${unit}\\]\\s*=\\s*([\\d.]+)`, 'i')); if (match) res.setHeader(header, match[1]) }
    res.type('text/plain').send(content)
  } catch (error) { console.error(error.message); if (!res.headersSent) res.status(400).json({ message: error.message }) }
  finally { processes.delete(req.body.requestId); active = false; if (directory) await fs.rm(directory, { recursive: true, force: true }) }
})
app.use((error, _req, res, _next) => res.status(400).json({ message: error.message }))
app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`PrintHub Orca API ready with ${profileIndex.size} inherited presets`))
