import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useModelHistory, saveDraft, loadDraft, encodeProject, decodeProject, downloadFile } from './projectStore.js'
import { WorkspaceServices, apiJson } from './WorkspacePanels.jsx'
import { plateFromProfile } from './profileUtils.js'
import './styles.css'

const SlicerWorkspace = lazy(() => import('./SlicerWorkspace.jsx'))
const OrcaGCodeViewer = lazy(() => import('./GCodeViewer.jsx'))
const loadSlicerModelUtils = () => import('./slicerModelUtils.js')
const loadWorkspaceTools = () => import('./workspaceTools.js')

const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api/v1',
  issuer: import.meta.env.VITE_OIDC_ISSUER,
  authUrl: import.meta.env.VITE_OIDC_AUTH_URL,
  tokenUrl: import.meta.env.VITE_OIDC_TOKEN_URL,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI || window.location.origin,
  scope: import.meta.env.VITE_OIDC_SCOPE || 'openid email profile'
}

const emptyProfiles = { printers: [], presets: [], filaments: [] }

function processFamily(name, settings = {}) {
  const source = settings.inherits || name || ''
  const marker = source.lastIndexOf('@')
  if (marker < 0) return ''
  return source.slice(marker + 1).split(' - ', 1)[0].trim().toLowerCase()
}

function randomValue() { return crypto.randomUUID() }

function createVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeJwt(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded.padEnd(encoded.length + ((4 - encoded.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch { return null }
}

function App() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('printhub.accessToken'))
  const [user, setUser] = useState(() => readUser())
  const [authError, setAuthError] = useState('')
  const [health, setHealth] = useState({ live: 'checking', ready: 'checking' })
  const [loggingIn, setLoggingIn] = useState(false)
  const [profiles, setProfiles] = useState(emptyProfiles)
  const [profileError, setProfileError] = useState('')
  const [allModels, setAllModels, history] = useModelHistory([])
  const [plates, setPlates] = useState([{ id: 'plate-1', name: 'Plate 1' }])
  const [activePlate, setActivePlate] = useState('plate-1')
  const [projectName, setProjectName] = useState('Untitled')
  const [draftReady, setDraftReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [versions, setVersions] = useState({})
  const [filamentSlots, setFilamentSlots] = useState([])
  const [processOverrides, setProcessOverrides] = useState({})
  const [plateJobs, setPlateJobs] = useState({})
  const projectFileRef = useRef(null)
  const models = useMemo(() => allModels.filter(m => (m.plateId || 'plate-1') === activePlate), [allModels, activePlate])
  function setModels(update) {
    setAllModels(current => {
      const active = current.filter(m => (m.plateId || 'plate-1') === activePlate)
      const next = typeof update === 'function' ? update(active) : update
      return [...current.filter(m => (m.plateId || 'plate-1') !== activePlate), ...next.map(m => ({ ...m, plateId: activePlate }))]
    })
  }
  const [selectedModelIds, setSelectedModelIds] = useState([])
  const [job, setJob] = useState(null)
  const [sliceError, setSliceError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [queueingAll, setQueueingAll] = useState(false)
  const [bundleFile, setBundleFile] = useState(null)
  const [bundleStatus, setBundleStatus] = useState('')
  const [importingBundle, setImportingBundle] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [selectedFilament, setSelectedFilament] = useState('')
  const [selectedProcess, setSelectedProcess] = useState('')
  const [profileSettings, setProfileSettings] = useState({ printers: {}, filaments: {}, presets: {} })
  const [workspaceMode, setWorkspaceMode] = useState('prepare')
  const [gcode, setGcode] = useState(null)
  const [gcodeLoading, setGcodeLoading] = useState(false)
  const [gcodeError, setGcodeError] = useState('')
  const [previewPlate, setPreviewPlate] = useState(null)
  const [historicalPreview, setHistoricalPreview] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('printhub.theme') || 'dark')
  const refreshPromiseRef = useRef(null)
  const printerSelectionTouched = useRef(false)
  const sliceGeneration = useRef(0)
  const fingerprintAtSlice = useRef('')
  const owner = user?.sub
  const fingerprint = useMemo(() => JSON.stringify([activePlate, selectedPrinter, selectedFilament, selectedProcess, versions, filamentSlots, processOverrides, models.map(({ id, geometry, position, rotation, scaleVector, visible, painting, layerRanges, settings }) => ({ id, geometry: geometry.uuid, position, rotation, scaleVector, visible, painting, layerRanges, settings }))]), [models, activePlate, selectedPrinter, selectedFilament, selectedProcess, versions, filamentSlots, processOverrides])
  const currentFingerprint = useRef(fingerprint); currentFingerprint.current = fingerprint

  function projectSnapshot() { return { name: projectName, models: allModels, plates, activePlate, selectedPrinter, selectedFilament, selectedProcess, versions, filamentSlots, processOverrides, plateJobs } }
  function restoreProject(project) {
    sliceGeneration.current++
    setSubmitting(false)
    history.reset(project.models || []); setPlates(project.plates?.length ? project.plates : [{ id: 'plate-1', name: 'Plate 1' }]); setActivePlate(project.activePlate || 'plate-1'); setProjectName(project.name || 'Untitled')
    setSelectedPrinter(project.selectedPrinter || ''); setSelectedFilament(project.selectedFilament || ''); setSelectedProcess(project.selectedProcess || ''); setVersions(project.versions || {}); setProcessOverrides(project.processOverrides || {}); setPlateJobs(project.plateJobs || {})
    setJob(null); setGcode(null); setSelectedModelIds([])
    setFilamentSlots(project.filamentSlots || [])
  }
  useEffect(() => {
    if (!owner) return
    let alive = true
    setDraftReady(false)
    loadDraft(owner).then(project => { if (alive) restoreProject(project || {}) }).catch(e => setSaveStatus(`Could not restore draft: ${e.message}`)).finally(() => { if (alive) setDraftReady(true) })
    return () => { alive = false }
  }, [owner])
  useEffect(() => {
    if (!owner || !draftReady) return
    let current = true
    setSaveStatus('Saving…')
    const timer = setTimeout(() => { saveDraft(owner, projectSnapshot()).then(() => { if (current) setSaveStatus('Autosaved') }).catch(e => { if (current) setSaveStatus(`Autosave failed: ${e.message}`) }) }, 900)
    return () => { current = false; clearTimeout(timer) }
  }, [allModels, plates, activePlate, projectName, selectedPrinter, selectedFilament, selectedProcess, versions, filamentSlots, processOverrides, plateJobs, owner, draftReady])
  useEffect(() => {
    if (job?.status === 'completed' && fingerprintAtSlice.current && fingerprintAtSlice.current !== fingerprint) { setJob(null); setGcode(null) }
  }, [fingerprint, job?.status])
  useEffect(() => {
    function shortcuts(event) {
      if (event.target.matches('input,textarea,select') || event.target.isContentEditable) return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z') { event.preventDefault(); event.stopImmediatePropagation(); event.shiftKey ? history.redo() : history.undo() }
      if (key === 'y') { event.preventDefault(); history.redo() }
      if (key === 's') { event.preventDefault(); saveProject() }
      if (key === 'o') { event.preventDefault(); projectFileRef.current?.click() }
      if (key === 'n') { event.preventDefault(); newProject() }
    }
    window.addEventListener('keydown', shortcuts, true)
    return () => window.removeEventListener('keydown', shortcuts, true)
  }, [allModels, plates, activePlate, projectName, selectedPrinter, selectedProcess, selectedFilament, versions, filamentSlots, processOverrides, plateJobs])

  function saveProject() { downloadFile(`${projectName.replace(/[^a-z0-9 _-]/gi, '') || 'Untitled'}.printhub`, JSON.stringify(encodeProject(projectSnapshot()))); setSaveStatus('Project exported') }
  async function exportCurrentPlate() {
    try { const { exportPlate3mf } = await loadWorkspaceTools(); downloadFile('printhub-plate.3mf', exportPlate3mf(models)) }
    catch (error) { setSliceError(error.message) }
  }
  async function openProjectFile(event) {
    const file = event.target.files?.[0]; if (!file) return
    try { restoreProject(await decodeProject(JSON.parse(await file.text()))); setSaveStatus(`Opened ${file.name}`) } catch (e) { setSliceError(e.message) } finally { event.target.value = '' }
  }

  const displayName = useMemo(
    () => user?.email || user?.preferred_username || user?.sub || 'authenticated user',
    [user]
  )

  useEffect(() => {
    exchangeCallback()
    checkHealth('/health/live', 'live')
    checkHealth('/health/ready', 'ready')
  }, [])

  useEffect(() => {
    if (accessToken) loadProfiles()
  }, [accessToken])

  useEffect(() => {
    if (!selectedPrinter && profiles.printers[0]) setSelectedPrinter(profiles.printers[0])
    if (!selectedFilament && profiles.filaments[0]) setSelectedFilament(profiles.filaments[0])
    if (!selectedProcess && profiles.presets[0]) setSelectedProcess(profiles.presets[0])
  }, [profiles, selectedPrinter, selectedFilament, selectedProcess])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const selections = [
      ['printers', selectedPrinter],
      ['filaments', selectedFilament],
      ['presets', selectedProcess]
    ].filter(([, name]) => name)
    Promise.all(selections.map(async ([category, name]) => {
      const response = await apiFetch(versions[category] ? `/profiles/${versions[category]}` : `/slicer/profiles/${category}/${encodeURIComponent(name)}`)
      if (!response.ok) throw new Error(`${category} profile details unavailable`)
      const result = await response.json()
      return [category, name, result.settings]
    })).then((entries) => {
      if (cancelled) return
      setProfileSettings((current) => {
        const next = { ...current }
        entries.forEach(([category, name, settings]) => { next[category] = { ...next[category], [name]: settings } })
        return next
      })
    }).catch(error => { if (!cancelled) setProfileError(error.message) })
    return () => { cancelled = true }
  }, [accessToken, selectedPrinter, selectedFilament, selectedProcess, versions])

  useEffect(() => {
    if (printerSelectionTouched.current || !selectedProcess || !selectedPrinter) return
    const processSettings = profileSettings.presets[selectedProcess]
    const family = processFamily(selectedProcess, processSettings)
    if (!family) return
    const matchingPrinter = profiles.printers.find((printer) => printer.toLowerCase().includes(family))
    if (matchingPrinter && matchingPrinter !== selectedPrinter) setSelectedPrinter(matchingPrinter)
  }, [profiles.printers, profileSettings.presets, selectedProcess, selectedPrinter])

  async function exchangeCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return
    const verifier = sessionStorage.getItem('printhub.oidc.verifier')
    const expectedState = sessionStorage.getItem('printhub.oidc.state')
    if (!verifier || params.get('state') !== expectedState) {
      setAuthError('The login state expired. Start a new Keycloak login.')
      return
    }
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, code, redirect_uri: config.redirectUri, code_verifier: verifier })
      })
      if (!response.ok) throw new Error(`Keycloak returned ${response.status}: ${await response.text()}`)
      const result = await response.json()
      storeTokens(result)
      sessionStorage.removeItem('printhub.oidc.verifier')
      sessionStorage.removeItem('printhub.oidc.state')
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch (error) {
      setAuthError(error.message)
      sessionStorage.removeItem('printhub.oidc.verifier')
      sessionStorage.removeItem('printhub.oidc.state')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  async function startLogin() {
    setAuthError('')
    setLoggingIn(true)
    const verifier = createVerifier()
    const state = randomValue()
    sessionStorage.setItem('printhub.oidc.verifier', verifier)
    sessionStorage.setItem('printhub.oidc.state', state)
    const challenge = await createChallenge(verifier)
    const query = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri, scope: config.scope, state, code_challenge_method: 'S256', code_challenge: challenge })
    window.location.assign(`${config.authUrl}?${query}`)
  }

  function logout() {
    const idToken = localStorage.getItem('printhub.idToken')
    for (const key of ['printhub.accessToken', 'printhub.idToken', 'printhub.user']) localStorage.removeItem(key)
    sessionStorage.removeItem('printhub.refreshToken'); setAccessToken(null); setUser(null)
    const query = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: `${window.location.origin}/` })
    if (idToken) query.set('id_token_hint', idToken)
    window.location.assign(`${config.issuer}/protocol/openid-connect/logout?${query}`)
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem('printhub.theme', next)
      return next
    })
  }

  async function checkHealth(path, key) {
    try {
      const response = await fetch(path)
      setHealth((current) => ({ ...current, [key]: response.ok ? 'ok' : 'failed' }))
    } catch { setHealth((current) => ({ ...current, [key]: 'failed' })) }
  }

  async function apiFetch(path, options = {}) {
    let token = accessToken
    const claims = decodeJwt(token || '')
    if (!token || (claims?.exp && claims.exp <= Math.floor(Date.now() / 1000) + 30)) {
      try {
        token = await refreshAccessToken()
      } catch {
        expireSession('Your session expired. Sign in through Keycloak again.')
        throw new Error('Your session expired. Sign in again.')
      }
    }
    const headers = new Headers(options.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    let response = await fetch(`${config.apiUrl}${path}`, { ...options, headers })
    if (response.status !== 401) return response

    try {
      token = await refreshAccessToken()
    } catch {
      expireSession('Your session expired. Sign in through Keycloak again.')
      return response
    }
    headers.set('Authorization', `Bearer ${token}`)
    response = await fetch(`${config.apiUrl}${path}`, { ...options, headers })
    if (response.status === 401) expireSession('Keycloak could not renew your session. Sign in again.')
    return response
  }

  function storeTokens(result) {
    localStorage.setItem('printhub.accessToken', result.access_token)
    if (result.id_token) localStorage.setItem('printhub.idToken', result.id_token)
    if (result.refresh_token) sessionStorage.setItem('printhub.refreshToken', result.refresh_token)
    setAccessToken(result.access_token)
    const decodedUser = decodeJwt(result.access_token)
    localStorage.setItem('printhub.user', JSON.stringify(decodedUser))
    setUser(decodedUser)
  }

  async function refreshAccessToken() {
    if (refreshPromiseRef.current) return refreshPromiseRef.current
    const refreshToken = sessionStorage.getItem('printhub.refreshToken')
    if (!refreshToken) throw new Error('No refresh token is available')

    refreshPromiseRef.current = (async () => {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          refresh_token: refreshToken
        })
      })
      if (!response.ok) throw new Error(`Keycloak token refresh returned ${response.status}`)
      const result = await response.json()
      storeTokens(result)
      return result.access_token
    })()

    try {
      return await refreshPromiseRef.current
    } finally {
      refreshPromiseRef.current = null
    }
  }

  function expireSession(message) {
    localStorage.removeItem('printhub.accessToken')
    localStorage.removeItem('printhub.idToken')
    localStorage.removeItem('printhub.user')
    sessionStorage.removeItem('printhub.refreshToken')
    setAccessToken(null)
    setUser(null)
    setAuthError(message)
  }

  async function loadProfiles() {
    setProfileError('')
    const categories = ['printers', 'presets', 'filaments']
    const results = await Promise.allSettled(categories.map(async (category) => {
      const response = await apiFetch(`/slicer/profiles/${category}`)
      if (!response.ok) throw new Error(`${category} profiles unavailable`)
      return [category, (await response.json()).profiles]
    }))
    const next = { ...emptyProfiles }
    results.forEach((result) => { if (result.status === 'fulfilled') next[result.value[0]] = result.value[1] })
    if (results.some((result) => result.status === 'rejected')) {
      setProfileError('No slicer profiles are installed yet. Add printer, process, and filament profiles before slicing.')
    }
    setProfiles(next)
  }

  async function importBundle() {
    if (!bundleFile) return setBundleStatus('Choose an .orca_printer bundle first.')
    const form = new FormData()
    form.append('bundle', bundleFile)
    setImportingBundle(true); setBundleStatus('')
    try {
      const response = await apiFetch('/slicer/profile-bundles', { method: 'POST', body: form })
      if (!response.ok) throw new Error(await readableError(response, 'Profile import failed'))
      const result = await response.json()
      const count = Object.values(result).reduce((total, names) => total + names.length, 0)
      setBundleStatus(`Imported ${count} profile${count === 1 ? '' : 's'}.`)
      await loadProfiles()
    } catch (error) { setBundleStatus(error.message) }
    finally { setImportingBundle(false) }
  }

  const printerSettings = profileSettings.printers[selectedPrinter] || {}
  const plate = useMemo(() => plateFromProfile(printerSettings), [printerSettings])

  async function addModelFiles(files) {
    // FileList is live and the input is cleared immediately after this handler.
    // Snapshot it before awaiting the lazily loaded geometry module.
    const pendingFiles = Array.from(files || [])
    const { loadStlFiles } = await loadSlicerModelUtils()
    const added = await loadStlFiles(pendingFiles, plate, models)
    if (!added.length) return
    setModels((current) => [...current, ...added])
    setSelectedModelIds(added.map((model) => model.id))
    setSliceError('')
  }

  function selectModel(modelId, additive = false) {
    setSelectedModelIds((current) => {
      if (!modelId) return additive ? current : []
      if (additive) return current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId]
      return [modelId]
    })
  }

  function updateModel(modelId, patch) {
    setModels((current) => current.map((model) => model.id === modelId ? { ...model, ...patch } : model))
  }

  function updateModels(patches) {
    const updates = patches instanceof Map ? patches : new Map(Object.entries(patches || {}))
    if (!updates.size) return
    setModels((current) => current.map((model) => updates.has(model.id) ? { ...model, ...updates.get(model.id) } : model))
  }

  function reorderModels(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return
    setModels((current) => {
      const sourceIndex = current.findIndex((model) => model.id === sourceId)
      const targetIndex = current.findIndex((model) => model.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  async function arrangeAll(options = {}) {
    try { const { arrangeModels } = await loadSlicerModelUtils(); setModels(arrangeModels(models, plate, options)); setSliceError('') }
    catch (error) { setSliceError(error.message) }
  }

  function deleteModel(modelId) {
    setModels((current) => current.filter((model) => model.id !== modelId))
    setSelectedModelIds((current) => current.filter((id) => id !== modelId))
  }

  function duplicateSelected() {
    const copies = models.filter((model) => selectedModelIds.includes(model.id)).map((model) => ({
      ...model,
      id: crypto.randomUUID(),
      name: `${model.name.replace(/\.stl$/i, '')} copy.stl`,
      position: { ...model.position, x: model.position.x + 10 }
    }))
    if (!copies.length) return
    setModels((current) => [...current, ...copies])
    setSelectedModelIds(copies.map((model) => model.id))
  }

  function newProject() {
    if (allModels.length && !confirm('Start a new project? Save the current project first if you want to keep it.')) return
    history.reset([]); setPlates([{ id: 'plate-1', name: 'Plate 1' }]); setActivePlate('plate-1'); setProjectName('Untitled'); setPlateJobs({})
    sliceGeneration.current++; setSubmitting(false)
    setSelectedModelIds([])
    setJob(null)
    setGcode(null)
    setGcodeError('')
    setSliceError('')
    setWorkspaceMode('prepare')
  }

  function changePrinter(name) {
    printerSelectionTouched.current = true
    setSelectedPrinter(name)
  }

  async function saveProfile(category, name, settings, versionId) {
    setProfileSettings(current => ({ ...current, [category]: { ...current[category], [name]: settings } }))
    setVersions(current => ({ ...current, [category]: versionId }))
    if (category === 'printers') setSelectedPrinter(name)
    if (category === 'presets') { setSelectedProcess(name); setProcessOverrides({}) }
    if (category === 'filaments') setSelectedFilament(name)
    await loadProfiles()
  }
  async function downloadJob(target) {
    try { const response = await apiFetch(`/slice-jobs/${target.id}/gcode`); if (!response.ok) throw new Error(await readableError(response, 'G-code download failed')); downloadFile(`${target.name || target.id}.gcode`, await response.blob()) } catch (e) { setSliceError(e.message) }
  }
  async function openJob(target) {
    const generation = ++sliceGeneration.current
    fingerprintAtSlice.current = currentFingerprint.current
    setHistoricalPreview(true)
    try {
      const source = await apiJson(apiFetch, target.printer_profile_version_id ? `/profiles/${target.printer_profile_version_id}` : `/slicer/profiles/printers/${encodeURIComponent(target.printer_profile)}`)
      if (generation !== sliceGeneration.current) return
      setPreviewPlate(plateFromProfile(source.settings))
    } catch { if (generation !== sliceGeneration.current) return; setPreviewPlate(null) }
    setJob(target); setGcode(null); setWorkspaceMode('preview')
    if (target.status === 'completed') await loadGcode(target.id, generation)
    else if (['queued', 'slicing', 'retrying'].includes(target.status)) {
      setSubmitting(true)
      try { await pollJob(target.id, sliceGeneration.current) } catch(e) { setSliceError(e.message) } finally { setSubmitting(false) }
    }
  }
  async function importStoredModel(file) {
    try { const response = await apiFetch(`/files/${file.id}/content`); if (!response.ok) throw new Error('Could not download stored model'); await addModelFiles([new File([await response.blob()], file.name)]); setWorkspaceMode('prepare') } catch (e) { setSliceError(e.message) }
  }
  function selectVersion(category, id) { setVersions(current => ({ ...current, [category]: id })) }
  function switchPlate(id) {
    sliceGeneration.current++; setSubmitting(false); setActivePlate(id); setJob(null); setGcode(null); setSelectedModelIds([]); setWorkspaceMode('prepare')
  }
  function addPlate() { const id = crypto.randomUUID(); setPlates(current => [...current, { id, name: `Plate ${current.length + 1}` }]); switchPlate(id) }
  function removePlate(id) { if (plates.length < 2 || !confirm('Delete this plate and its objects?')) return; setAllModels(current => current.filter(m => (m.plateId || 'plate-1') !== id)); const next = plates.filter(p => p.id !== id); setPlates(next); switchPlate(next[0].id) }
  async function advancedAction(action, options = {}) {
    const { runModelAction } = await loadWorkspaceTools()
    const result = await runModelAction(action, models, selectedModelIds, plate, options)
    if (result.message) setSliceError(result.message)
    if (result.models) setModels(result.models)
    if (result.selectedIds) setSelectedModelIds(result.selectedIds)
  }
  async function generateCalibration(kind, options) {
    try { const { calibrationModels } = await loadWorkspaceTools(); const generated = calibrationModels(kind, options, plate); setModels(current => [...current, ...generated]); setSelectedModelIds(generated.map(m => m.id)); setWorkspaceMode('prepare') } catch(e) { setSliceError(e.message) }
  }
  async function cancelCurrentJob() {
    if (!job) return
    try { const result = await apiJson(apiFetch, `/slice-jobs/${job.id}/cancel`, { method: 'POST' }); sliceGeneration.current++; setJob(result); setSubmitting(false) } catch (e) { setSliceError(e.message) }
  }

  async function submitSlice(targetPlateId = activePlate, monitor = true) {
    setHistoricalPreview(false); setPreviewPlate(null)
    const slicingModels = allModels.filter(m => (m.plateId || 'plate-1') === targetPlateId && m.visible !== false)
    if (!slicingModels.length) return setSliceError('No visible models on this plate. Show a model before slicing.')
    if (!selectedPrinter || !selectedProcess || !selectedFilament) return setSliceError('Select printer, process, and filament profiles first.')
    const family = processFamily(selectedProcess, profileSettings.presets[selectedProcess])
    if (family && !selectedPrinter.toLowerCase().includes(family)) {
      return setSliceError(`The selected process is for ${family}, but the selected printer is ${selectedPrinter}. Choose matching profiles.`)
    }
    const invalidModel = slicingModels.find((model) => ![model.position.x, model.position.y, model.position.z, model.rotation.x, model.rotation.y, model.rotation.z, ...(Object.values(model.scaleVector || { x: model.scale || 1, y: model.scale || 1, z: model.scale || 1 }))].every(Number.isFinite))
    if (invalidModel) return setSliceError(`The model "${invalidModel.name}" has an invalid transform. Reset or reposition it before slicing.`)
    const { exportPlate3mf, validatePlate } = await loadWorkspaceTools()
    const issues = validatePlate(slicingModels, plate)
    if (issues.length) return setSliceError(issues.join(' '))
    const calibration = slicingModels.find(m => m.calibration)?.calibration
    if (calibration && slicingModels.length !== 1) return setSliceError('Slice a calibration tower on its own plate so calibration commands cannot affect another model.')
    if (slicingModels.some(m => Number(m.settings?.extruder || 1) > filamentSlots.length + 1)) return setSliceError('An object uses a filament slot that has not been configured. Add its filament slot first.')
    const generation = ++sliceGeneration.current
    fingerprintAtSlice.current = currentFingerprint.current
    const requestFingerprint = currentFingerprint.current
    setSubmitting(true); setSliceError(''); setJob(null); setGcode(null); setGcodeError(''); setWorkspaceMode('preview')
    try {
      const uploadFile = exportPlate3mf(slicingModels)
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await uploadFile.arrayBuffer())))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('')
      const signed = await apiFetch('/files/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          content_type: uploadFile.type || 'model/stl',
          sha256: digest
        })
      })
      if (!signed.ok) throw new Error(await readableError(signed, 'Could not create a signed upload URL'))
      const uploadTarget = await signed.json()
      setUploadProgress(0)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open(uploadTarget.method || 'PUT', uploadTarget.upload_url)
        xhr.setRequestHeader('Content-Type', uploadFile.type || 'model/stl')
        xhr.upload.onprogress = event => { if (event.lengthComputable) setUploadProgress(Math.round(event.loaded / event.total * 100)) }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Model upload failed (${xhr.status})`))
        xhr.onerror = () => reject(new Error('Model upload connection failed')); xhr.ontimeout = () => reject(new Error('Model upload timed out')); xhr.timeout = 300000; xhr.send(uploadFile)
      })
      setUploadProgress(null)
      const complete = await apiFetch(`/files/${uploadTarget.file_id}/complete`, { method: 'POST' })
      if (!complete.ok) throw new Error(await readableError(complete, 'Could not verify the model upload'))
      const model = await complete.json()
      const create = await apiFetch('/slice-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ file_id: model.id, printer_profile: selectedPrinter, process_profile: selectedProcess, filament_profile: selectedFilament, printer_profile_version_id: versions.printers || null, process_profile_version_id: versions.presets || null, filament_profile_version_id: versions.filaments || null, process_overrides: processOverrides, filament_profiles: filamentSlots, calibration: calibration || null, arrange: false })
      })
      if (!create.ok) throw new Error(await readableError(create, 'Could not create slicing job'))
      const created = await create.json()
      setPlateJobs(current => ({ ...current, [targetPlateId]: { ...created, fingerprint: requestFingerprint } }))
      setJob(created)
      if (monitor) await pollJob(created.id, generation)
      return true
    } catch (error) { setSliceError(error.message); return false }
    finally { setSubmitting(false); setUploadProgress(null) }
  }

  async function sliceAllPlates() {
    if (queueingAll || submitting) return
    setQueueingAll(true)
    try {
      for (const target of plates) {
        if (!allModels.some(m => (m.plateId || 'plate-1') === target.id && m.visible !== false)) continue
        if (!await submitSlice(target.id, false)) return
      }
      setWorkspaceMode('project')
    } finally { setQueueingAll(false) }
  }

  async function pollJob(jobId, generation = sliceGeneration.current) {
    while (generation === sliceGeneration.current) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      if (generation !== sliceGeneration.current) return
      const response = await apiFetch(`/slice-jobs/${jobId}`)
      if (!response.ok) throw new Error(await readableError(response, 'Could not read slicing status'))
      const next = await response.json()
      if (generation !== sliceGeneration.current) return
      setJob(next)
      if (['completed', 'failed', 'dead-lettered', 'cancelled'].includes(next.status)) {
        if (next.status === 'completed') { if (fingerprintAtSlice.current === currentFingerprint.current) await loadGcode(jobId); else { setJob(null); setSliceError('Slice completed for an earlier plate revision. Open it from Projects, or slice the updated plate.') } }
        else if (next.error_message) setSliceError(next.error_message)
        return
      }
    }
  }

  async function downloadGcode() {
    const response = await apiFetch(`/slice-jobs/${job.id}/gcode`)
    if (!response.ok) return setSliceError(await readableError(response, 'G-code download failed'))
    const blob = await response.blob()
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `${job.id}.gcode`; link.click(); URL.revokeObjectURL(url)
  }

  async function loadGcode(jobId, generation = sliceGeneration.current) {
    setGcodeLoading(true)
    setGcodeError('')
    try {
      const response = await apiFetch(`/slice-jobs/${jobId}/gcode`)
      if (!response.ok) throw new Error(await readableError(response, 'G-code viewer could not load the file'))
      const source = await response.text()
      if (generation === sliceGeneration.current) setGcode(source)
    } catch (error) {
      if (generation === sliceGeneration.current) setGcodeError(error.message)
    } finally {
      if (generation === sliceGeneration.current) setGcodeLoading(false)
    }
  }

  if (accessToken && owner && !draftReady) return <main className="screen"><p role="status">Restoring workspace…</p></main>

  if (!accessToken) {
    return <main className="screen"><section className="card login-card"><p className="eyebrow">PrintHub</p><h1>Sign in</h1><p>Continue with the PrintHub Keycloak identity provider.</p>{authError && <p className="error">{authError}</p>}<button onClick={startLogin} disabled={loggingIn}>{loggingIn ? 'Opening Keycloak…' : 'Continue to Keycloak'}</button></section></main>
  }

  const services = { apiFetch, profiles, refreshProfiles: loadProfiles, filamentSlots, setFilamentSlots, selectedPrinter, job, openJob, downloadJob, printJob: target => { setJob(target); setWorkspaceMode('device') }, importStoredModel, saveProject, openProject: () => projectFileRef.current?.click(), saveProfile, selectVersion, generateCalibration, advancedAction, processOverrides, updateProcess: patch => setProcessOverrides(current => { const next = { ...current }; for (const [key, value] of Object.entries(patch)) { if (value === '') delete next[key]; else next[key] = value } return next }), onError: setSliceError }
  return <WorkspaceServices.Provider value={services}><main className="app-screen" data-theme={theme}>
    <input ref={projectFileRef} hidden type="file" accept=".printhub,.json" onChange={openProjectFile} />
    <header className="app-topbar">
      <div className="app-topbar-left"><nav className="app-menu-bar" aria-label="Application menu"><Menu label="File" icon="file" items={[['New Project', 'Ctrl+N', newProject], ['Open Project', 'Ctrl+O', () => projectFileRef.current?.click()], ['Save Project', 'Ctrl+S', saveProject], ['Save Project as', 'Ctrl+Shift+S', () => { const name = prompt('Project name', projectName); if (name) { setProjectName(name); downloadFile(`${name}.printhub`, JSON.stringify(encodeProject({ ...projectSnapshot(), name }))) } }], ['Import', 'Ctrl+I', () => document.getElementById('model-file-input')?.click()], ['Export plate 3MF', '', exportCurrentPlate], ['Export G-code', '', job?.status === 'completed' ? downloadGcode : null], ['Print plate', '', job?.status === 'completed' ? () => setWorkspaceMode('device') : null]]} /></nav><button type="button" className="titlebar-icon-button" title="Save project" aria-label="Save project" onClick={saveProject}><TitleIcon name="save" size={16} /></button><button type="button" className="titlebar-icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!history.canUndo} onClick={history.undo}><TitleIcon name="undo" size={16} /></button><button type="button" className="titlebar-icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!history.canRedo} onClick={history.redo}><TitleIcon name="redo" size={16} /></button><button type="button" className="titlebar-calibration" onClick={() => setWorkspaceMode('calibration')}><TitleIcon name="calibration" size={16} /> Calibration</button></div>
      <span className="app-project-title" title={saveStatus} onDoubleClick={() => { const name = prompt('Project name', projectName); if (name) setProjectName(name) }}>{projectName} · {saveStatus || 'Draft'}</span>
      <div className="app-topbar-actions"><span className="health-dot" title={`API ${health.live}`} aria-label={`API ${health.live}`}><i className={health.live === 'ok' ? 'ok' : ''} /></span><span className="health-dot" title={`Services ${health.ready}`} aria-label={`Services ${health.ready}`}><i className={health.ready === 'ok' ? 'ok' : ''} /></span><details className="account-menu"><summary className="avatar-button" title={displayName} aria-label={`Account: ${displayName}`}>{(displayName[0] || 'P').toUpperCase()}</summary><div className="account-menu-content"><strong>{displayName}</strong><button type="button" className="account-menu-item" onClick={toggleTheme}><TitleIcon name="theme" size={15} /> Theme: {theme === 'dark' ? 'Dark' : 'Light'}</button><div className="account-profile-block"><p className="eyebrow">Profiles</p><p className="muted">Import an exported OrcaSlicer profile bundle.</p><div className="import-actions"><input type="file" accept=".orca_printer,.zip" onChange={(event) => setBundleFile(event.target.files?.[0] || null)} /><button type="button" className="secondary small" onClick={importBundle} disabled={importingBundle}>{importingBundle ? 'Importing…' : 'Import profiles'}</button></div>{bundleFile && <p className="muted selected-file">{bundleFile.name}</p>}{bundleStatus && <p className={bundleStatus.startsWith('Imported') ? 'success' : 'error'}>{bundleStatus}</p>}<button type="button" className="link-button" onClick={loadProfiles}>Refresh profile list</button></div><button type="button" className="account-menu-item danger" onClick={logout}><TitleIcon name="logout" size={15} /> Log out</button></div></details></div>
    </header>
    {authError && <div className="app-alert error">{authError}</div>}
    {profileError && <div className="app-alert notice">{profileError}</div>}
    {gcodeError && <div className="app-alert error">{gcodeError}</div>}
    <Suspense fallback={<div className="workspace-loading" role="status">Loading workspace…</div>}><SlicerWorkspace mode={workspaceMode} onModeChange={setWorkspaceMode} models={models} selectedIds={selectedModelIds} onSelect={selectModel} onUpdateModel={updateModel} onUpdateModels={updateModels} onReorderModels={reorderModels} onAddFiles={addModelFiles} onArrange={arrangeAll} onDeleteModel={deleteModel} onDuplicate={duplicateSelected} onSlice={() => submitSlice()} onSliceAll={sliceAllPlates} onDownloadGcode={downloadGcode} submitting={submitting || queueingAll} job={job} gcodeLoading={gcodeLoading} uploadProgress={uploadProgress} onCancelJob={cancelCurrentJob} previewContent={gcode ? <Suspense fallback={<div className="workspace-loading" role="status">Loading G-code viewer…</div>}><OrcaGCodeViewer gcode={gcode} job={job} onDownload={downloadGcode} plate={previewPlate || plate} models={historicalPreview ? [] : models} /></Suspense> : null} plate={plate} profiles={profiles} selectedPrinter={selectedPrinter} selectedFilament={selectedFilament} selectedProcess={selectedProcess} onPrinterChange={name => { changePrinter(name); setVersions(v => ({ ...v, printers: null })) }} onFilamentChange={name => { setSelectedFilament(name); setVersions(v => ({ ...v, filaments: null })) }} onProcessChange={name => { setSelectedProcess(name); setVersions(v => ({ ...v, presets: null })); setProcessOverrides({}) }} printerSettings={printerSettings} filamentSettings={profileSettings.filaments[selectedFilament]} processSettings={{ ...profileSettings.presets[selectedProcess], ...processOverrides }} error={sliceError} onError={setSliceError} plates={plates} activePlate={activePlate} onSwitchPlate={switchPlate} onAddPlate={addPlate} onRemovePlate={removePlate} onRenamePlate={(id, name) => setPlates(current => current.map(p => p.id === id ? { ...p, name } : p))} /></Suspense>
  </main></WorkspaceServices.Provider>
}

function TitleIcon({ name, size = 16 }) {
  const paths = {
    file: <><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    save: <><path d="M4 4h13l3 3v13H4z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
    undo: <><path d="M9 8 4 12l5 4" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 8 5 4-5 4" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>,
    calibration: <><path d="M4 19 19 4M8 4h4M4 8v4m16 4v4h-4" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="7" r="3" /></>,
    theme: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-17-7 2 2m10 10 2 2m0-14-2 2M8 17l-2 2" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M9 12h9" /></>
  }
  return <svg className="title-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Menu({ label, items, icon }) {
  return <details className="app-menu"><summary>{icon && <TitleIcon name={icon} size={15} />}<span>{label}</span></summary><div className="app-menu-list">{items.map(([name, shortcut, action]) => <button type="button" key={`${label}-${name}`} disabled={!action} onClick={action || undefined}><span>{name}</span><kbd>{shortcut}</kbd></button>)}</div></details>
}

async function readableError(response, fallback) {
  try { const body = await response.json(); return body.detail || body.message || fallback } catch { return fallback }
}

function readUser() {
  try { return JSON.parse(localStorage.getItem('printhub.user') || 'null') } catch { return null }
}

createRoot(document.getElementById('root')).render(<App />)
