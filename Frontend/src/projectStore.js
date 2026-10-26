import { useCallback, useRef, useState } from 'react'

const VERSION = 1
export function encodeProject(project) {
  return { ...project, format: 'printhub-project', version: VERSION, models: project.models.map(({ geometry, file, ...model }) => ({ ...model, geometry: geometry.toJSON() })) }
}
export async function decodeProject(value) {
  if (value?.format !== 'printhub-project' || value.version !== VERSION || !Array.isArray(value.models)) throw new Error('Unsupported PrintHub project file')
  const THREE = await import('three')
  const loader = new THREE.BufferGeometryLoader()
  return { ...value, models: value.models.map((model) => ({ ...model, geometry: loader.parse(model.geometry) })) }
}
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('printhub-workspaces', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('projects')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function saveDraft(owner, project) {
  if (!owner) return
  const db = await database()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite')
      tx.objectStore('projects').put(encodeProject(project), owner)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } finally { db.close() }
}
export async function loadDraft(owner) {
  const db = await database()
  try {
    const result = await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(owner)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return result ? await decodeProject(result) : null
  } finally { db.close() }
}
export function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function useModelHistory(initial = []) {
  const [models, rawSet] = useState(initial)
  const current = useRef(initial)
  const past = useRef([])
  const future = useRef([])
  const lastTime = useRef(0)
  const [revision, setRevision] = useState(0)
  const setModels = useCallback((value) => {
    const next = typeof value === 'function' ? value(current.current) : value
    if (next === current.current) return
    past.current.push(current.current)
    if (past.current.length > 60) past.current.shift()
    lastTime.current = Date.now(); future.current = []; current.current = next
    rawSet(next); setRevision((v) => v + 1)
  }, [])
  const undo = useCallback(() => {
    if (!past.current.length) return
    future.current.push(current.current); current.current = past.current.pop(); rawSet(current.current); lastTime.current = 0; setRevision((v) => v + 1)
  }, [])
  const redo = useCallback(() => {
    if (!future.current.length) return
    past.current.push(current.current); current.current = future.current.pop(); rawSet(current.current); lastTime.current = 0; setRevision((v) => v + 1)
  }, [])
  const reset = useCallback((value) => { current.current = value; past.current = []; future.current = []; rawSet(value); setRevision((v) => v + 1) }, [])
  return [models, setModels, { undo, redo, reset, canUndo: !!past.current.length, canRedo: !!future.current.length, revision }]
}
