import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { JobsPanel, PrinterPanel, ProfileEditor, useServices } from './WorkspacePanels.jsx'
import { AdvancedTools, CalibrationTools } from './advancedUi.jsx'

export default function SlicerWorkspace({
  mode,
  onModeChange,
  models,
  selectedIds,
  onSelect,
  onUpdateModel,
  onUpdateModels,
  onReorderModels,
  onAddFiles,
  onArrange,
  onDeleteModel,
  onDuplicate,
  onSlice,
  onDownloadGcode,
  submitting,
  job,
  gcodeLoading,
  previewContent,
  plate,
  profiles,
  selectedPrinter,
  selectedFilament,
  selectedProcess,
  onPrinterChange,
  onFilamentChange,
  onProcessChange,
  printerSettings,
  filamentSettings,
  processSettings,
  onError,
  error,
  plates = [], activePlate, onSwitchPlate, onAddPlate, onRemovePlate, onRenamePlate,
  onSliceAll, uploadProgress, onCancelJob
}) {
  const services = useServices()
  const [advanced, setAdvanced] = useState(null)
  const [paintTool, setPaintTool] = useState(null)
  const [paintValue, setPaintValue] = useState(1)
  const [measuring, setMeasuring] = useState(false)
  const fileInputRef = useRef(null)
  const [tool, setTool] = useState(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [transformPopover, setTransformPopover] = useState(null)
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const [arrangeOptions, setArrangeOptions] = useState({ spacing: 0, autoRotate: false, allowMultipleMaterials: true, alignY: false })
  const [placeOnFace, setPlaceOnFace] = useState(false)
  const [draggedModelId, setDraggedModelId] = useState(null)
  const [processTab, setProcessTab] = useState('Quality')
  const [settingsMode, setSettingsMode] = useState('Simple')
  const [settingsDialog, setSettingsDialog] = useState(null)
  const [sliceMenuOpen, setSliceMenuOpen] = useState(false)
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [processModeOpen, setProcessModeOpen] = useState(false)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [flushDialogOpen, setFlushDialogOpen] = useState(false)
  const [refreshingProfiles, setRefreshingProfiles] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(470)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const selectedModel = models.find((model) => model.id === selectedIds[0])

  useEffect(() => {
    if (!resizingSidebar) return undefined
    function move(event) { setSidebarWidth(Math.min(520, Math.max(380, event.clientX))) }
    function stop() { setResizingSidebar(false) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  }, [resizingSidebar])

  const summary = useMemo(() => ({
    nozzle: firstValue(printerSettings?.nozzle_diameter) || '—',
    layerHeight: firstValue(processSettings?.layer_height) || selectedProcess?.match(/(\d+(?:\.\d+)?)mm/i)?.[1] || '—',
    material: firstValue(filamentSettings?.filament_type) || selectedFilament || '—'
  }), [printerSettings, processSettings, filamentSettings, selectedFilament, selectedProcess])

  function addFiles(files) {
    onAddFiles(files).catch((error) => onError(error.message))
  }

  function updateSelected(patch) {
    if (!selectedModel) return
    if (selectedIds.length < 2 || !onUpdateModels) return onUpdateModel(selectedModel.id, patch)
    const selected = models.filter((model) => selectedIds.includes(model.id))
    const updates = new Map()
    if (patch.position) {
      const delta = axisDelta(selectedModel.position, patch.position)
      selected.forEach((model) => updates.set(model.id, { position: addAxes(model.position, delta) }))
    } else if (patch.rotation) {
      const delta = axisDelta(selectedModel.rotation, patch.rotation)
      selected.forEach((model) => updates.set(model.id, { rotation: addAxes(model.rotation, delta) }))
    } else if (patch.scaleVector) {
      const ratio = axisRatio(scaleObject(selectedModel), patch.scaleVector)
      selected.forEach((model) => updates.set(model.id, { scaleVector: multiplyAxes(scaleObject(model), ratio) }))
    } else {
      selected.forEach((model) => updates.set(model.id, patch))
    }
    onUpdateModels(updates)
  }

  async function refreshProfiles() {
    setRefreshingProfiles(true)
    try { await services.refreshProfiles?.() }
    catch (error) { onError(error.message) }
    finally { setRefreshingProfiles(false) }
  }

  useEffect(() => {
    function onKeyDown(event) {
      const tag = event.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || event.target?.isContentEditable) return
      if (event.key === ' ' && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        return setSpeedDialOpen((current) => !current)
      }
      if (event.key === 'Escape') {
        setTransformPopover(null)
        setArrangeOpen(false)
        setPlaceOnFace(false)
        setTool(null)
        setPaintTool(null); setMeasuring(false); setAdvanced(null)
        return onSelect(null, false)
      }
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault()
        const tabs = ['prepare', 'preview', 'device', 'calibration']
        return onModeChange(tabs[(tabs.indexOf(mode) + 1) % tabs.length])
      }
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        if (event.shiftKey) return setLeftCollapsed((current) => !current)
        return onModeChange(mode === 'prepare' ? 'preview' : 'prepare')
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        return fileInputRef.current?.click()
      }
      if (event.key.toLowerCase() === 'm' && selectedIds.length) return openTransform('translate')
      if (event.key.toLowerCase() === 'r' && selectedIds.length) return openTransform('rotate')
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 's' && selectedIds.length) return openTransform('scale')
      if (event.key.toLowerCase() === 'f' && selectedIds.length) {
        setTransformPopover(null)
        setTool(null)
        return setPlaceOnFace((current) => !current)
      }
      if (event.key.toLowerCase() === 'a' && models.length) {
        setTool(null)
        setPlaceOnFace(false)
        return onArrange({ ...arrangeOptions, selectedOnly: event.shiftKey, selectedIds })
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'd' && models.length) {
        event.preventDefault()
        return onDuplicate()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'k' && selectedIds.length) {
        event.preventDefault()
        return onDuplicate()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'c' && selectedIds.length) {
        event.preventDefault()
        return onDuplicate()
      }
      const keyboardTools = { b: 'Mesh boolean', l: 'Support paint', p: 'Seam paint', h: 'Fuzzy skin paint', n: 'Color/multi-material paint', t: 'Text/emboss', u: 'Measure', y: 'Assemble' }
      const keyboardTool = keyboardTools[event.key.toLowerCase()]
      if (keyboardTool && selectedIds.length) return handleToolAction(keyboardTool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [arrangeOptions, mode, models, onArrange, onDuplicate, onError, onModeChange, onSelect, selectedIds])

  useEffect(() => {
    function closeDropdowns(event) {
      if (event.target.closest('.toolbar-popover, .split-button-wrap, .slice-action-wrap, .top-action-wrap, .mode-toggle-wrap')) return
      setTransformPopover(null)
      setArrangeOpen(false)
      setSliceMenuOpen(false)
      setPrintMenuOpen(false)
      setProcessModeOpen(false)
      if (!event.target.closest('.build-plate-wrap')) {
        setPlaceOnFace(false)
        setTool(null)
      }
    }
    document.addEventListener('pointerup', closeDropdowns)
    return () => document.removeEventListener('pointerup', closeDropdowns)
  }, [])

  function openTransform(nextTool) {
    setPlaceOnFace(false)
    setTool(nextTool)
    setTransformPopover((current) => current === nextTool ? null : nextTool)
  }

  function handlePlaceOnFace() {
    if (!selectedIds.length) return
    setTransformPopover(null)
    setTool(null)
    setPlaceOnFace((current) => !current)
  }

  function handleArrange(overrides = {}) {
    setTransformPopover(null)
    setPlaceOnFace(false)
    setTool(null)
    onArrange({ ...arrangeOptions, ...overrides, selectedIds })
    setArrangeOpen(false)
  }

  function handleSliceAction() {
    setSliceMenuOpen(false)
    onSlice()
  }

  function handleToolAction(label) {
    const actions = { 'Split to objects': 'split', 'Split to parts': 'split-parts', 'Variable layer height': 'layers', 'Mesh boolean': 'meshboolean', Cut: 'cut', 'Text/emboss': 'text', Text: 'text', Assemble: 'assembly', Assembly: 'assembly' }
    if (label === 'Add plate') return onAddPlate?.()
    if (label === 'Measure') { setMeasuring(v => !v); setPaintTool(null); return }
    const paints = { 'Support paint': 'support', 'Support painting': 'support', 'Seam paint': 'seam', 'Seam painting': 'seam', 'Fuzzy skin paint': 'fuzzy', 'Fuzzy skin painting': 'fuzzy', 'Color/multi-material paint': 'material', 'Multimaterial painting': 'material' }
    if (paints[label]) { setPaintTool(paints[label]); setPaintValue(1); setTool(null); setPlaceOnFace(false); return }
    if (actions[label]) { setAdvanced(actions[label]); return }
    onError(`${label} is not available in the browser workspace.`)
  }

  return <section className="slicer-workspace">
    <header className="workspace-header">
      <div className="workspace-tabs" role="tablist" aria-label="Slicer workflow">
        <button type="button" className="workspace-tab home-tab" onClick={() => onModeChange('home')} aria-label="Home"><Icon name="home" size={18} /></button>
        {['Prepare', 'Preview', 'Device', 'Project'].map((tab) => <button type="button" key={tab} className={`workspace-tab ${mode === tab.toLowerCase() ? 'active' : ''}`} onClick={() => onModeChange(tab.toLowerCase())}><Icon name={tab === 'Prepare' ? 'plate' : tab.toLowerCase()} size={17} /><span>{tab}</span></button>)}
      </div>
      <div className="workspace-actions">
        <div className="top-action-wrap"><div className="top-pill-group"><button type="button" className="top-pill-chevron" aria-label="Slice plate options" onClick={() => setSliceMenuOpen((current) => !current)}>⌄</button><button type="button" className="top-pill top-pill-slice" onClick={handleSliceAction} disabled={submitting || !models.length}>{submitting ? 'Slicing…' : 'Slice plate'}</button></div>{sliceMenuOpen && <div className="top-action-menu"><button type="button" onClick={() => { setSliceMenuOpen(false); onSliceAll?.() }}>Slice all plates</button></div>}</div>
        <div className="top-action-wrap"><div className="top-pill-group"><button type="button" className="top-pill-chevron" aria-label="Print options" onClick={() => setPrintMenuOpen((current) => !current)}>⌄</button><button type="button" className="top-pill top-pill-print" onClick={() => onModeChange('device')} disabled={job?.status !== 'completed'}>Print</button></div>{printMenuOpen && <div className="top-action-menu print-menu"><button type="button" onClick={() => { setPrintMenuOpen(false); onModeChange('device') }} disabled={job?.status !== 'completed'}>Print plate</button><button type="button" onClick={() => onModeChange('project')}>Choose completed slices</button><button type="button" onClick={() => { setPrintMenuOpen(false); onDownloadGcode() }} disabled={job?.status !== 'completed'}>Export G-code file</button><button type="button" onClick={() => onModeChange('device')}>Send to printer…</button></div>}</div>
      </div>
    </header>

    <div className="workspace-body">
      {!leftCollapsed && mode === 'prepare' && <aside className="workspace-panel preset-panel" style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, flexBasis: `${sidebarWidth}px` }}>
        {mode === 'prepare' && <>
          <section className="sidebar-section printer-section"><SidebarSectionHeader icon="printer" label="Printer"><button type="button" className="sidebar-icon-button connected" title="Printer connection" onClick={() => onModeChange('device')}><Icon name="wifi" size={17} /></button><button type="button" className="sidebar-icon-button" title="Printer settings" onClick={() => setSettingsDialog('printer')}><Icon name="sliders" size={17} /></button></SidebarSectionHeader><div className="printer-card"><div className="printer-thumb"><Icon name="printer" size={26} /></div><PresetSelect label="Printer" value={selectedPrinter} options={profiles.printers} onChange={onPrinterChange} /><div className="nozzle-box"><small>Nozzle</small><strong>⌄ {summary.nozzle}</strong></div></div></section>
          <section className="sidebar-section filament-section"><SidebarSectionHeader icon="filament" label="Filament"><button type="button" className={`sidebar-icon-button${refreshingProfiles ? ' spinning' : ''}`} title="Refresh installed profiles" aria-label="Refresh installed profiles" disabled={refreshingProfiles} onClick={refreshProfiles}><Icon name="sync" size={17} /></button><button type="button" className="sidebar-icon-button" title="Filament settings" onClick={() => setSettingsDialog('filament')}><Icon name="sliders" size={17} /></button></SidebarSectionHeader><div className="filament-row"><span className="filament-number">1</span><PresetSelect label="Filament" value={selectedFilament} options={profiles.filaments} onChange={onFilamentChange} /><button type="button" className="sidebar-icon-button edit-profile" title="Edit filament" onClick={() => setSettingsDialog('filament')}>✎</button></div>{profiles.filaments.length > 0 && <div className="filament-actions"><button type="button" className="link-button" onClick={() => services.setFilamentSlots(current => [...current, selectedFilament])}>+</button><button type="button" className="link-button" onClick={() => services.setFilamentSlots(current => current.slice(0, -1))}>−</button><button type="button" className="link-button flush-link" onClick={() => setFlushDialogOpen(true)}>Flush volumes</button></div>}{services.filamentSlots.map((name, index) => <div className="filament-row" key={index}><span className="filament-number">{index + 2}</span><PresetSelect label={`Filament ${index + 2}`} value={name} options={profiles.filaments} onChange={value => services.setFilamentSlots(current => current.map((item, i) => i === index ? value : item))} /><button type="button" onClick={() => services.setFilamentSlots(current => current.filter((_, i) => i !== index))} aria-label={`Remove filament ${index + 2}`}>×</button></div>)}</section>
          <section className="sidebar-section process-section"><SidebarSectionHeader icon="process" label="Process"><div className="process-scope-switch"><button type="button" className="active">Global</button><button type="button" onClick={() => selectedModel ? setAdvanced('object-settings') : onError('Select an object first.')}>Objects</button></div><div className="process-header-actions"><button type="button" className="sidebar-icon-button" title="Advanced process options" onClick={() => setSettingsDialog('process')}><Icon name="sliders" size={16} /></button><div className="mode-toggle-wrap"><button type="button" className="mode-toggle" title="Settings mode" onClick={() => setProcessModeOpen((current) => !current)}><i />{settingsMode}</button>{processModeOpen && <div className="mode-menu">{['Simple', 'Advanced', 'Develop'].map((value) => <button type="button" key={value} onClick={() => { setSettingsMode(value); setProcessModeOpen(false) }}>{value}</button>)}</div>}</div><button type="button" className="sidebar-icon-button" title="Compare settings" onClick={() => setSettingsDialog('process')}><Icon name="list" size={16} /></button><button type="button" className="sidebar-icon-button" title="Transfer settings" onClick={() => setSettingsDialog('process')}><Icon name="transfer" size={16} /></button></div></SidebarSectionHeader><div className="process-preset-row"><PresetSelect label="Process" value={selectedProcess} options={profiles.presets} onChange={onProcessChange} /><button type="button" className="sidebar-icon-button" title="Save process preset" onClick={() => setSettingsDialog('process')}><Icon name="save" size={16} /></button><button type="button" className="sidebar-icon-button" title="Search process settings" onClick={() => setSettingsDialog('process')}><Icon name="search" size={16} /></button></div><ProcessSettings settings={processSettings} onEdit={(key, value) => services.updateProcess({ [key]: value })} activeTab={processTab} onTabChange={setProcessTab} mode={settingsMode} onModeChange={setSettingsMode} /></section>
          <div className="panel-section objects-section"><p className="objects-header"><span><Icon name="objects" size={16} /> Objects</span><span>{models.length}</span></p>
            <div className="object-list">
              <div className="plate-tree-row"><span className="tree-caret">⌄</span><Icon name="plate" size={15} /><span>{plates.find(p => p.id === activePlate)?.name || 'Plate 1'}</span><span className="plate-state">{models.length ? 'ready' : 'empty'}</span></div>
              {models.length ? models.map((model) => <div className={`object-row-wrap object-row-nested${draggedModelId === model.id ? ' dragging' : ''}`} key={model.id} draggable onDragStart={() => setDraggedModelId(model.id)} onDragEnd={() => setDraggedModelId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onReorderModels?.(draggedModelId, model.id); setDraggedModelId(null) }}><button type="button" className="object-inline-toggle" title={model.visible === false ? 'Show object' : 'Hide object'} aria-label={model.visible === false ? 'Show object' : 'Hide object'} onClick={(event) => { event.stopPropagation(); onUpdateModel(model.id, { visible: model.visible === false }) }}><Icon name={model.visible === false ? 'eye-off' : 'eye'} size={14} /></button><button type="button" className={`object-row ${selectedIds.includes(model.id) ? 'selected' : ''}`} onClick={(event) => onSelect(model.id, event.shiftKey)}><span className="drag-grip" aria-hidden="true">⋮⋮</span><span className="object-icon"><Icon name="cube" size={15} /></span><span className="extruder-swatch" title="Filament 1">1</span><span title={model.name}>{model.name}</span></button><button type="button" className="object-remove" aria-label={`Remove ${model.name}`} title={`Remove ${model.name}`} onClick={(event) => { event.stopPropagation(); onDeleteModel(model.id) }}>×</button></div>) : <p className="panel-help object-empty-help">Add a model to begin preparing your plate.</p>}
            </div>
          </div>
        </>}
        <button type="button" className="sidebar-resize-handle" onPointerDown={(event) => { event.preventDefault(); setResizingSidebar(true) }} aria-label="Resize settings sidebar" title="Drag to resize sidebar" />
      </aside>}

      <section className="workspace-main">
        {mode === 'prepare' ? <>
          <div className="viewport-row"><div className="viewport-column">
            <div className="plate-tabs">{plates.map(p => <button type="button" key={p.id} className={p.id === activePlate ? 'active' : ''} onClick={() => onSwitchPlate(p.id)} onDoubleClick={() => { const name = prompt('Plate name', p.name); if (name) onRenamePlate(p.id, name) }}>{p.name}</button>)}<button type="button" onClick={onAddPlate} title="Add plate">＋</button><button type="button" disabled={plates.length < 2} onClick={() => onRemovePlate(activePlate)} title="Remove current plate">−</button></div><button type="button" className="canvas-collapse" onClick={() => setLeftCollapsed((current) => !current)} aria-label={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{leftCollapsed ? '›' : '‹'}</button>
            <div className="workspace-toolbar canvas-toolbar-top" aria-label="Viewport tools">
              <div className="toolbar-group"><ToolbarButton icon="add" label="Add object" shortcut="Ctrl+I" onClick={() => fileInputRef.current?.click()} primary /><ToolbarButton icon="add-plate" label="Add plate" onClick={onAddPlate} /><ArrangeSplitButton open={arrangeOpen} options={arrangeOptions} onToggle={() => { setTransformPopover(null); setPlaceOnFace(false); setTool(null); setArrangeOpen((current) => !current) }} onArrange={handleArrange} onChange={setArrangeOptions} disabled={!models.length} /></div>
              <span className="toolbar-divider" />
              <div className="toolbar-group"><ToolbarButton icon="copy" label="Add instance" shortcut="Ctrl+D" onClick={onDuplicate} disabled={!selectedIds.length} /><ToolbarButton icon="split" label="Split to objects" onClick={() => handleToolAction('Split to objects')} disabled={!selectedIds.length} /><ToolbarButton icon="split-parts" label="Split to parts" onClick={() => handleToolAction('Split to parts')} disabled={!selectedIds.length} /><ToolbarButton icon="layers" label="Variable layer height" onClick={() => handleToolAction('Variable layer height')} disabled={!selectedIds.length} /></div>
              <span className="toolbar-divider" />
              <div className="toolbar-group"><ToolbarButton icon="move" label="Move" shortcut="M" active={tool === 'translate'} onClick={() => openTransform('translate')} disabled={!selectedIds.length} /><ToolbarButton icon="rotate" label="Rotate" shortcut="R" active={tool === 'rotate'} onClick={() => openTransform('rotate')} disabled={!selectedIds.length} /><ToolbarButton icon="scale" label="Scale" shortcut="S" active={tool === 'scale'} onClick={() => openTransform('scale')} disabled={!selectedIds.length} /><ToolbarButton icon="face" label="Place on face" shortcut="F" onClick={handlePlaceOnFace} disabled={!selectedIds.length} active={placeOnFace} />{['cut', 'meshboolean', 'supportpaint', 'seampaint', 'fuzzy', 'mmu', 'text', 'measure', 'assembly'].map((icon) => <ToolbarButton key={icon} icon={icon} label={toolbarLabel(icon)} shortcut={toolbarShortcut(icon)} onClick={() => handleToolAction(toolbarLabel(icon))} disabled={!selectedIds.length && icon !== 'text'} />)}</div>
              <input id="model-file-input" ref={fileInputRef} className="hidden-file-input" type="file" accept=".stl,.step,.3mf,.obj,.amf,model/stl,model/obj" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
            </div>
            {transformPopover && selectedModel && <TransformPopover tool={transformPopover} model={selectedModel} selectionCount={selectedIds.length} onUpdate={updateSelected} onClose={() => { setTransformPopover(null); setTool(null) }} />}
            {(paintTool || measuring) && <div className="tool-status-bar">{paintTool ? <><strong>{paintTool} brush</strong><select value={paintValue} onChange={e => setPaintValue(Number(e.target.value))}>{paintTool === 'material' ? Array.from({ length: services.filamentSlots.length + 1 }, (_, i) => <option key={i} value={i + 1}>Filament {i + 1}</option>) : <><option value="1">Enforce</option><option value="2">Block</option></>}<option value="0">Erase</option></select><span>Click a face. Shift-click paints parallel faces.</span><button onClick={() => services.advancedAction('clear-paint', { tool: paintTool }).catch(error => onError(error.message))}>Clear</button></> : <span>Click two surface points to measure their distance.</span>}<button onClick={() => { setPaintTool(null); setMeasuring(false) }}>Done</button></div>}<BuildPlateScene models={models} selectedIds={selectedIds} onSelect={onSelect} onUpdateModel={onUpdateModel} onUpdateModels={onUpdateModels} onArrange={handleArrange} onAutoOrient={handlePlaceOnFace} plateName={plates.find(p => p.id === activePlate)?.name || 'Plate'} plateNumber={String(plates.findIndex(p => p.id === activePlate) + 1).padStart(2, '0')} onRename={() => { const name = prompt('Plate name', plates.find(p => p.id === activePlate)?.name); if (name) onRenamePlate(activePlate, name) }} onShowObjects={() => setLeftCollapsed(false)} plate={plate} paintTool={paintTool} paintValue={paintValue} measuring={measuring} onMeasure={onError} tool={tool} placeOnFace={placeOnFace} onPlacedOnFace={() => setPlaceOnFace(false)} onDropFiles={addFiles} />
          </div></div>
        </> : mode === 'preview' ? <div className="preview-workspace">{previewContent || <EmptyPreview job={job} loading={gcodeLoading} uploadProgress={uploadProgress} onCancel={onCancelJob} />}</div> : <WorkspacePlaceholder title={mode} />}
        {error && <div className="canvas-notification"><Icon name="warning" size={15} /><span>{error}</span><button type="button" aria-label="Dismiss notification" onClick={() => onError('')}>×</button></div>}
      </section>
    </div>
    {advanced && <AdvancedTools action={advanced} models={models} selectedIds={selectedIds} onAction={services.advancedAction} onClose={() => setAdvanced(null)} onUpdateModel={onUpdateModel} />}
    {settingsDialog && <ProfileEditor category={{ printer: 'printers', filament: 'filaments', process: 'presets' }[settingsDialog]} name={{ printer: selectedPrinter, filament: selectedFilament, process: selectedProcess }[settingsDialog]} settings={{ printer: printerSettings, filament: filamentSettings, process: processSettings }[settingsDialog]} onClose={() => setSettingsDialog(null)} onSaved={services.saveProfile} />}
    {flushDialogOpen && <FlushVolumesDialog filaments={[selectedFilament, ...services.filamentSlots]} settings={processSettings} onClose={() => setFlushDialogOpen(false)} onApply={(values) => { services.updateProcess(values); setFlushDialogOpen(false) }} />}
    {speedDialOpen && <SpeedDial onClose={() => setSpeedDialOpen(false)} onAction={(action) => { setSpeedDialOpen(false); if (action === 'add') fileInputRef.current?.click(); if (action === 'slice') onSlice(); if (action === 'preview') onModeChange('preview') }} />}
  </section>
}

function BuildPlateScene({ models, selectedIds, onSelect, onUpdateModel, onUpdateModels, onArrange, onAutoOrient, plate, tool, placeOnFace, onPlacedOnFace, onDropFiles, paintTool, paintValue, measuring, onMeasure, plateName, plateNumber, onRename, onShowObjects }) {
  const mountRef = useRef(null)
  const sceneStateRef = useRef(null)
  const [draggingFiles, setDraggingFiles] = useState(false)
  const callbacksRef = useRef({ onSelect, onUpdateModel, onUpdateModels, onDropFiles, onPlacedOnFace, onMeasure })
  const interactionRef = useRef({ placeOnFace, selectedIds, tool })
  callbacksRef.current = { onSelect, onUpdateModel, onUpdateModels, onDropFiles, onPlacedOnFace, onMeasure }
  interactionRef.current = { placeOnFace, selectedIds, tool, paintTool, paintValue, measuring }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#484848')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000)
    // Keep printer coordinates Z-up in the scene so the world-space gizmo
    // axes agree with the numeric position/rotation fields.
    camera.up.set(0, 0, 1)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.screenSpacePanning = true
    orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    orbit.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN
    orbit.touches.ONE = THREE.TOUCH.ROTATE
    orbit.touches.TWO = THREE.TOUCH.PAN
    scene.add(new THREE.HemisphereLight(0xffffff, 0x343434, 2.1))
    const light = new THREE.DirectionalLight(0xffffff, 2.4)
    light.position.set(250, 400, 250)
    scene.add(light)

    const displayFrame = new THREE.Group()
    scene.add(displayFrame)
    displayFrame.add(createBuildPlate(plate))
    const transform = new TransformControls(camera, renderer.domElement)
    transform.setMode(tool || 'translate')
    transform.setSpace('world')
    transform.setSize(2.2)
    transform.showX = true
    transform.showY = true
    transform.showZ = true
    const transformHelper = transform.getHelper()
    scene.add(transformHelper)
    const modelMeshes = new Map()
    const state = { scene, camera, renderer, orbit, transform, transformHelper, displayFrame, modelMeshes, raycaster: new THREE.Raycaster(), bedPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pointer: new THREE.Vector2(), downPoint: null, directDrag: null, transformSession: null, faceHighlight: null }
    sceneStateRef.current = state

    const onTransformState = (event) => {
      orbit.enabled = !event.value
      const primary = transform.object
      if (event.value && primary) {
        primary.updateMatrix()
        const ids = interactionRef.current.selectedIds.includes(primary.userData.modelId) ? interactionRef.current.selectedIds : [primary.userData.modelId]
        state.transformSession = {
          primary,
          primaryStart: primary.matrix.clone(),
          entries: ids.map((id) => {
            const mesh = modelMeshes.get(id)
            mesh?.updateMatrix()
            return mesh ? [id, mesh, mesh.matrix.clone()] : null
          }).filter(Boolean)
        }
      } else if (!event.value && state.transformSession) {
        const updates = new Map(state.transformSession.entries.map(([id, mesh]) => [id, meshState(mesh)]))
        callbacksRef.current.onUpdateModels?.(updates)
        state.transformSession = null
      }
    }
    const onTransformObjectChange = () => {
      const session = state.transformSession
      if (!session?.primary) return
      session.primary.updateMatrix()
      const delta = session.primary.matrix.clone().multiply(session.primaryStart.clone().invert())
      for (const [, mesh, initial] of session.entries) {
        if (mesh === session.primary) continue
        const matrix = delta.clone().multiply(initial)
        matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
        mesh.updateMatrixWorld(true)
      }
    }
    transform.addEventListener('dragging-changed', onTransformState)
    transform.addEventListener('objectChange', onTransformObjectChange)

    function pointerDown(event) {
      if (event.button !== 0 || (transform.enabled && (transform.dragging || transform.axis))) return
      const hit = raycastModel(event, false)
      const selectedMesh = hit?.object
      if (!event.shiftKey && !interactionRef.current.placeOnFace && !interactionRef.current.paintTool && !interactionRef.current.measuring && (!interactionRef.current.tool || interactionRef.current.tool === 'translate') && selectedMesh) {
        if (!interactionRef.current.selectedIds.includes(selectedMesh.userData.modelId)) callbacksRef.current.onSelect(selectedMesh.userData.modelId, false)
        const point = state.raycaster.ray.intersectPlane(state.bedPlane, new THREE.Vector3())
        if (point) {
          const localPoint = state.displayFrame.worldToLocal(point.clone())
          const ids = interactionRef.current.selectedIds.includes(selectedMesh.userData.modelId) ? interactionRef.current.selectedIds : [selectedMesh.userData.modelId]
          const entries = ids.map((id) => {
            const mesh = modelMeshes.get(id)
            return mesh ? [id, mesh, mesh.position.clone()] : null
          }).filter(Boolean)
          state.directDrag = { mesh: selectedMesh, startPoint: localPoint, entries }
          state.downPoint = { x: event.clientX, y: event.clientY }
          state.orbit.enabled = false
          return
        }
      }
      state.downPoint = { x: event.clientX, y: event.clientY }
    }
    function raycastModel(event, onlySelected = false) {
      const bounds = renderer.domElement.getBoundingClientRect()
      state.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      state.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      state.raycaster.setFromCamera(state.pointer, camera)
      const objects = onlySelected ? [modelMeshes.get(interactionRef.current.selectedIds[0])].filter(Boolean) : [...modelMeshes.values()]
      return state.raycaster.intersectObjects(objects, false)[0]
    }
    function pointerMove(event) {
      if (state.directDrag) {
        raycastModel(event, false)
        const point = state.raycaster.ray.intersectPlane(state.bedPlane, new THREE.Vector3())
        if (point) {
          const localPoint = state.displayFrame.worldToLocal(point.clone())
          const dx = localPoint.x - state.directDrag.startPoint.x
          const dy = localPoint.y - state.directDrag.startPoint.y
          for (const [, mesh, initial] of state.directDrag.entries) {
            mesh.position.x = initial.x + dx
            mesh.position.y = initial.y + dy
            mesh.updateMatrixWorld(true)
          }
        }
        return
      }
      if (!interactionRef.current.placeOnFace || transform.dragging) return clearFaceHighlight(state)
      const hit = raycastModel(event, true)
      if (hit?.face) showFaceHighlight(state, hit.object, hit.face)
      else clearFaceHighlight(state)
    }
    function pointerUp(event) {
      if (event.button !== 0) return
      if (state.directDrag) {
        const updates = new Map(state.directDrag.entries.map(([id, mesh]) => [id, meshState(mesh)]))
        callbacksRef.current.onUpdateModels?.(updates)
        state.directDrag = null
        state.downPoint = null
        state.orbit.enabled = true
        return
      }
      if (!state.downPoint || transform.dragging) return
      const distance = Math.hypot(event.clientX - state.downPoint.x, event.clientY - state.downPoint.y)
      state.downPoint = null
      if (distance > 5) return
      const hit = raycastModel(event, interactionRef.current.placeOnFace || Boolean(interactionRef.current.paintTool))
      if (interactionRef.current.measuring && hit) {
        state.measurePoints ||= []; state.measurePoints.push(hit.point.clone())
        if (state.measurePoints.length === 2) {
          const [a, b] = state.measurePoints; callbacksRef.current.onMeasure(`Distance: ${a.distanceTo(b).toFixed(3)} mm`)
          if (state.measureLine) { scene.remove(state.measureLine); state.measureLine.geometry.dispose(); state.measureLine.material.dispose() }
          state.measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: '#ffcf55' })); scene.add(state.measureLine); state.measurePoints = []
        }
        return
      }
      if (interactionRef.current.paintTool && hit) {
        const model = hit.object.userData.model, painting = structuredClone(model.painting || {}), key = interactionRef.current.paintTool, faces = [hit.faceIndex]
        if (event.shiftKey) {
          const p = hit.object.geometry.attributes.position, normal = hit.face.normal, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3()
          for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); n.subVectors(b, a).cross(c.clone().sub(a)).normalize(); if (n.dot(normal) > .995) faces.push(i / 3) }
        }
        for (const face of faces) { painting[face] ||= {}; if (interactionRef.current.paintValue) painting[face][key] = interactionRef.current.paintValue; else delete painting[face][key] }
        callbacksRef.current.onUpdateModel(model.id, { painting }); return
      }
      if (interactionRef.current.placeOnFace) {
        const selectedMesh = modelMeshes.get(interactionRef.current.selectedIds[0])
        if (hit?.object === selectedMesh && hit.face) {
          placeMeshOnFace(selectedMesh, hit)
          callbacksRef.current.onUpdateModel(selectedMesh.userData.modelId, meshState(selectedMesh))
          callbacksRef.current.onPlacedOnFace()
          clearFaceHighlight(state)
        }
        return
      }
      callbacksRef.current.onSelect(hit?.object?.userData.modelId || null, event.shiftKey)
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)

    function resize() {
      const width = mount.clientWidth || 900
      const height = mount.clientHeight || 700
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const centerX = plate.originX + plate.width / 2
    const centerY = plate.originY + plate.depth / 2
    const span = Math.max(plate.width, plate.depth)
    camera.position.set(centerX + span * .9, centerY - span * .9, span * 1.15)
    orbit.target.set(centerX, centerY, 0)
    orbit.maxDistance = span * 6
    orbit.minDistance = Math.max(span / 10, 1)
    orbit.update()
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    let frame
    function animate() {
      frame = requestAnimationFrame(animate)
      orbit.update()
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      sceneStateRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      transform.removeEventListener('dragging-changed', onTransformState)
      transform.removeEventListener('objectChange', onTransformObjectChange)
      transform.dispose()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointermove', pointerMove)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      orbit.dispose()
      scene.traverse((object) => { object.geometry?.dispose(); if (object.material) object.material.dispose() })
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [plate])

  useEffect(() => {
    const state = sceneStateRef.current
    if (!state) return
    const currentIds = new Set(models.map((model) => model.id))
    for (const [id, mesh] of state.modelMeshes) {
      if (!currentIds.has(id)) {
        state.displayFrame.remove(mesh)
        mesh.material.dispose()
        state.modelMeshes.delete(id)
      }
    }
    models.forEach((model) => {
      let mesh = state.modelMeshes.get(model.id)
      if (!mesh) {
        mesh = new THREE.Mesh(model.geometry.index ? model.geometry.toNonIndexed() : model.geometry.clone(), new THREE.MeshStandardMaterial({ roughness: .68, metalness: .08, transparent: true, side: THREE.DoubleSide }))
        mesh.userData.modelId = model.id
        mesh.userData.sourceGeometry = model.geometry
        state.displayFrame.add(mesh)
        state.modelMeshes.set(model.id, mesh)
      }
      if (mesh.userData.sourceGeometry !== model.geometry) { mesh.geometry.dispose(); mesh.geometry = model.geometry.index ? model.geometry.toNonIndexed() : model.geometry.clone(); mesh.userData.sourceGeometry = model.geometry }
      mesh.userData.model = model
      const colors = new Float32Array(mesh.geometry.attributes.position.count * 3), base = new THREE.Color(selectedIds.includes(model.id) ? '#ffc857' : '#41d3bd')
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) { const paint = model.painting?.[Math.floor(i / 3)]; const color = paint && Object.values(paint).some(Boolean) ? new THREE.Color(paint.support === 2 || paint.seam === 2 ? '#eb6c70' : paint.fuzzy ? '#c78aef' : '#61a8ff') : base; colors.set([color.r, color.g, color.b], i * 3) }
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mesh.material.vertexColors = true
      mesh.position.set(model.position.x, model.position.y, model.position.z)
      mesh.rotation.set(THREE.MathUtils.degToRad(model.rotation.x), THREE.MathUtils.degToRad(model.rotation.y), THREE.MathUtils.degToRad(model.rotation.z))
      mesh.scale.set(...scaleVectorFor(model))
      mesh.visible = model.visible !== false
      const selected = selectedIds.includes(model.id)
      mesh.material.color.set(0xffffff)
      mesh.material.opacity = selected ? .94 : .88
    })
    const activeMesh = state.modelMeshes.get(selectedIds[0])
    if (activeMesh) {
      state.transform.attach(activeMesh)
      state.transform.enabled = Boolean(tool) && !placeOnFace && !paintTool && !measuring
      state.transformHelper.visible = Boolean(tool) && !placeOnFace
    } else {
      state.transform.detach()
      state.transform.enabled = false
      state.transformHelper.visible = false
    }
  }, [models, selectedIds, plate])

  useEffect(() => {
    const state = sceneStateRef.current
    if (state) {
      state.transform.setMode(tool || 'translate')
      state.transform.enabled = Boolean(state.transform.object) && Boolean(tool) && !placeOnFace && !paintTool && !measuring
      state.transformHelper.visible = Boolean(state.transform.object) && Boolean(tool) && !placeOnFace
      if (!placeOnFace) clearFaceHighlight(state)
    }
  }, [tool, placeOnFace, paintTool, measuring])

  function cameraView(view = 'Default') {
    const state = sceneStateRef.current
    if (!state) return
    const center = new THREE.Vector3(plate.originX + plate.width / 2, plate.originY + plate.depth / 2, 0)
    const span = Math.max(plate.width, plate.depth)
    const direction = view === 'Top' ? new THREE.Vector3(0, -.001, 1) : view === 'Front' ? new THREE.Vector3(0, -1, .001) : new THREE.Vector3(.9, -.9, 1.15)
    state.camera.position.copy(center).add(direction.normalize().multiplyScalar(span * 1.8))
    state.orbit.target.copy(center); state.orbit.update()
  }
  return <div className={`build-plate-wrap${placeOnFace ? ' face-picking' : ''}`} tabIndex={0}
    onDragEnter={event => { event.preventDefault(); setDraggingFiles(true) }} onDragOver={event => event.preventDefault()}
    onDragLeave={event => { if (event.currentTarget === event.target) setDraggingFiles(false) }}
    onDrop={event => { event.preventDefault(); setDraggingFiles(false); onDropFiles(event.dataTransfer.files) }}>
    <div ref={mountRef} className="build-plate-scene" />
    <div className="plate-scene-label">{plateName}<button type="button" aria-label="Rename plate" title="Rename plate" onClick={onRename}><Icon name="edit" size={16} /></button></div>
    <div className="plate-scene-number">{plateNumber}</div>
    <div className="plate-action-stack">
      <button type="button" title="Place on face (F)" onClick={onAutoOrient} disabled={!selectedIds.length}><Icon name="face" size={24} /></button>
      <button type="button" title="Arrange (A)" onClick={() => onArrange({ selectedOnly: false })} disabled={!models.length}><Icon name="arrange" size={24} /></button>
    </div>
    <div className="scene-view-cube"><button type="button" onClick={() => cameraView('Top')}>Top</button><button type="button" onClick={() => cameraView('Front')}>Front</button><i>X</i></div>
    <div className="scene-round-tools"><button type="button" title="Show objects" onClick={onShowObjects}><Icon name="list" size={17} /></button><button type="button" title="Fit to plate" onClick={() => cameraView()}><Icon name="magnifier" size={17} /></button></div>
    {placeOnFace && <div className="face-picking-banner">Click a face on the selected model to place it on the bed</div>}
    {draggingFiles && <div className="drag-overlay"><strong>Drop STL, OBJ, 3MF, STEP or AMF files here</strong><span>Release to add models to the plate</span></div>}
    {tool && !placeOnFace && <div className="gizmo-hint"><span className="gizmo-axis x">X</span><span className="gizmo-axis y">Y</span><span className="gizmo-axis z">Z</span> Drag the colored handles or enter exact values above</div>}
  </div>
}

function createBuildPlate(plate) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(plate.width + 10, plate.depth + 10, 7), new THREE.MeshStandardMaterial({ color: 0x2f2f31, roughness: .86, metalness: .1 }))
  base.position.set(plate.originX + plate.width / 2, plate.originY + plate.depth / 2, -3.5)
  group.add(base)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(plate.width, plate.depth), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: .9, metalness: .08, side: THREE.DoubleSide }))
  plane.position.set(plate.originX + plate.width / 2, plate.originY + plate.depth / 2, .05)
  group.add(plane)
  const grid = new THREE.Group()
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x555559, transparent: true, opacity: .82 })
  const step = plate.width > 300 || plate.depth > 300 ? 25 : 10
  for (let x = plate.originX; x <= plate.originX + plate.width + .01; x += step) grid.add(line([[x, plate.originY, .02], [x, plate.originY + plate.depth, .02]], gridMaterial))
  for (let y = plate.originY; y <= plate.originY + plate.depth + .01; y += step) grid.add(line([[plate.originX, y, .02], [plate.originX + plate.width, y, .02]], gridMaterial))
  group.add(grid)
  const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(plate.originX, plate.originY, .08), new THREE.Vector3(plate.originX + plate.width, plate.originY, .08), new THREE.Vector3(plate.originX + plate.width, plate.originY + plate.depth, .08), new THREE.Vector3(plate.originX, plate.originY + plate.depth, .08)
  ]), new THREE.LineBasicMaterial({ color: 0x8a8a8e }))
  group.add(border)
  const exclusionMaterial = new THREE.LineBasicMaterial({ color: 0xff6b6b })
  plate.exclusions.forEach((polygon) => {
    if (polygon.length < 2) return
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(polygon.map(({ x, y }) => new THREE.Vector3(x, y, .04))), exclusionMaterial))
  })
  const origin = new THREE.Vector3(plate.originX, plate.originY, .12)
  group.add(line([[origin.x, origin.y, origin.z], [origin.x + Math.min(24, plate.width * .12), origin.y, origin.z]], new THREE.LineBasicMaterial({ color: 0xd95563 })))
  group.add(line([[origin.x, origin.y, origin.z], [origin.x, origin.y + Math.min(24, plate.depth * .12), origin.z]], new THREE.LineBasicMaterial({ color: 0x55c982 })))
  group.add(line([[origin.x, origin.y, origin.z], [origin.x, origin.y, origin.z + 24]], new THREE.LineBasicMaterial({ color: 0x5a8fe8 })))
  return group
}

function line(points, material) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), material)
}

function meshState(mesh) {
  return {
    position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    rotation: { x: THREE.MathUtils.radToDeg(mesh.rotation.x), y: THREE.MathUtils.radToDeg(mesh.rotation.y), z: THREE.MathUtils.radToDeg(mesh.rotation.z) },
    scaleVector: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z }
  }
}

function scaleVectorFor(model) {
  const value = model?.scaleVector || model?.scale || 1
  if (typeof value === 'object') return [Number(value.x) || 1, Number(value.y) || 1, Number(value.z) || 1]
  const scalar = Number(value) || 1
  return [scalar, scalar, scalar]
}

export function placeMeshOnFace(mesh, intersection) {
  mesh.updateMatrix()
  const normalInParent = intersection.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrix)).normalize()
  const down = new THREE.Vector3(0, 0, -1)
  mesh.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(normalInParent, down))
  mesh.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(mesh)
  mesh.position.z -= bounds.min.z
  mesh.updateMatrixWorld(true)
}

function showFaceHighlight(state, mesh, face) {
  const position = mesh.geometry.attributes.position
  const points = [face.a, face.b, face.c].map((index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld))
  clearFaceHighlight(state)
  state.faceHighlight = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffc857, linewidth: 2 }))
  state.scene.add(state.faceHighlight)
}

function clearFaceHighlight(state) {
  if (!state.faceHighlight) return
  state.scene.remove(state.faceHighlight)
  state.faceHighlight.geometry.dispose()
  state.faceHighlight.material.dispose()
  state.faceHighlight = null
}

function SidebarSectionHeader({ icon, label, children }) {
  return <div className="sidebar-section-header"><span><Icon name={icon} size={19} />{label}</span><div>{children}</div></div>
}

function PresetSelect({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function close(event) { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return <div className="custom-combobox" ref={ref}><button type="button" className="combobox-button" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}><Icon name="chevron-left" size={13} /><span>{value || `Select ${label.toLowerCase()}`}</span></button>{open && <div className="combobox-menu" role="listbox">{options.length ? options.map((option) => <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false) }}><span className={option === value ? 'combobox-check selected' : 'combobox-check'}>{option === value ? '●' : ''}</span>{option}</button>) : <span className="combobox-empty">No {label.toLowerCase()} profiles</span>}</div>}</div>
}

function toolbarLabel(icon) {
  return { cut: 'Cut', meshboolean: 'Mesh boolean', supportpaint: 'Support paint', seampaint: 'Seam paint', fuzzy: 'Fuzzy skin paint', mmu: 'Color/multi-material paint', text: 'Text/emboss', measure: 'Measure', assembly: 'Assemble', brimears: 'Brim ears' }[icon] || icon
}

function toolbarShortcut(icon) {
  return { cut: 'C', supportpaint: 'L', seampaint: 'P', fuzzy: 'H', mmu: 'N', text: 'T', measure: 'U', assembly: 'Y', brimears: 'E' }[icon]
}

function ToolbarButton({ icon, label, onClick, disabled = false, active = false, primary = false, shortcut }) {
  return <button type="button" className={`toolbar-button${active ? ' active' : ''}${primary ? ' primary-tool' : ''}`} onClick={onClick} disabled={disabled} title={`${label}${shortcut ? ` (${shortcut})` : ''}`} aria-label={`${label}${shortcut ? `, ${shortcut}` : ''}`}><Icon name={icon} size={19} /><span className="toolbar-label">{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>
}

function ArrangeSplitButton({ open, options, onToggle, onArrange, onChange, disabled }) {
  const update = (patch) => onChange({ ...options, ...patch })
  return <div className="split-button-wrap">
    <div className="split-button"><button type="button" className="toolbar-button split-main" onClick={() => onArrange({ selectedOnly: false })} disabled={disabled} title="Arrange all objects (A)"><Icon name="arrange" size={19} /><span className="toolbar-label">Arrange</span><kbd>A</kbd></button><button type="button" className="toolbar-button split-arrow" onClick={onToggle} disabled={disabled} aria-label="Arrange options" title="Arrange options">⌄</button></div>
    {open && <div className="toolbar-popover arrange-menu">
      <button type="button" className="arrange-menu-item" onClick={() => onArrange({ selectedOnly: false })}>Arrange all objects <kbd>[A]</kbd></button>
      <button type="button" className="arrange-menu-item" onClick={() => { update({ selectedOnly: true }); onArrange({ selectedOnly: true }) }}>Arrange objects on selected plates <kbd>[Shift+A]</kbd></button>
      <p className="arrange-help">0 means auto spacing.</p>
      <label className="arrange-option"><span>Spacing</span><input type="number" min="0" step="1" value={options.spacing} onChange={(event) => update({ spacing: Math.max(Number(event.target.value) || 0, 0) })} /></label>
      <label className="arrange-option"><input type="checkbox" checked={options.autoRotate} onChange={(event) => update({ autoRotate: event.target.checked })} /><span>Auto rotate for arrangement</span></label>
      <label className="arrange-option"><input type="checkbox" checked={options.allowMultipleMaterials} onChange={(event) => update({ allowMultipleMaterials: event.target.checked })} /><span>Allow multiple materials on same plate</span></label>
      <label className="arrange-option"><input type="checkbox" checked={options.alignY} onChange={(event) => update({ alignY: event.target.checked })} /><span>Align to Y axis</span></label>
      <div className="arrange-menu-actions"><button type="button" className="secondary small" onClick={() => onArrange({ selectedOnly: false })}>Arrange</button><button type="button" className="secondary small" onClick={() => onChange({ spacing: 0, selectedOnly: false, autoRotate: false, allowMultipleMaterials: true, alignY: false })}>Reset</button></div>
    </div>}
  </div>
}

function scaleObject(model) {
  return model.scaleVector || { x: model.scale || 1, y: model.scale || 1, z: model.scale || 1 }
}

function axisDelta(from, to) {
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
}

function axisRatio(from, to) {
  return { x: to.x / (from.x || 1), y: to.y / (from.y || 1), z: to.z / (from.z || 1) }
}

function addAxes(value, delta) {
  return { x: value.x + delta.x, y: value.y + delta.y, z: value.z + delta.z }
}

function multiplyAxes(value, ratio) {
  return { x: value.x * ratio.x, y: value.y * ratio.y, z: value.z * ratio.z }
}

function TransformPopover({ tool, model, selectionCount = 1, onUpdate, onClose }) {
  const [relative, setRelative] = useState({ x: 0, y: 0, z: 0 })
  const [uniform, setUniform] = useState(true)
  useEffect(() => setRelative({ x: 0, y: 0, z: 0 }), [tool, model.id])

  function updateVector(key, axis, value) {
    onUpdate({ [key]: { ...model[key], [axis]: Number(value) || 0 } })
  }

  function updateRelative(axis, value) {
    setRelative((current) => ({ ...current, [axis]: Number(value) || 0 }))
  }

  function applyAndClose() {
    if (tool === 'rotate' && Object.values(relative).some((value) => value !== 0)) {
      onUpdate({ rotation: { x: model.rotation.x + relative.x, y: model.rotation.y + relative.y, z: model.rotation.z + relative.z } })
    }
    onClose()
  }

  const scaleVector = model.scaleVector || { x: model.scale || 1, y: model.scale || 1, z: model.scale || 1 }
  function updateScale(axis, value) {
    const next = Math.max(Number(value) || 1, .01) / 100
    const nextVector = uniform ? { x: next, y: next, z: next } : { ...scaleVector, [axis]: next }
    onUpdate({ scaleVector: nextVector })
  }

  return <div className={`toolbar-popover transform-popover ${tool}`}>
    <button type="button" className="coordinate-button" aria-label="Coordinate system">⌄&nbsp; World coordinates</button>
    {selectionCount > 1 && <p className="selection-transform-note">Transforming {selectionCount} selected objects from the primary object.</p>}
    {tool === 'translate' && <VectorInputs label="Position" unit="mm" values={model.position} onChange={(axis, value) => updateVector('position', axis, value)} />}
    {tool === 'rotate' && <><VectorInputs label="Rotate (relative)" unit="°" values={relative} onChange={updateRelative} /><VectorInputs label="Rotate (absolute)" unit="°" values={model.rotation} onChange={(axis, value) => updateVector('rotation', axis, value)} /></>}
    {tool === 'scale' && <><VectorInputs label="Scale" unit="%" values={{ x: scaleVector.x * 100, y: scaleVector.y * 100, z: scaleVector.z * 100 }} onChange={updateScale} /><VectorInputs label="Size" unit="mm" values={{ x: model.dimensions.x * scaleVector.x, y: model.dimensions.y * scaleVector.y, z: model.dimensions.z * scaleVector.z }} onChange={(axis, value) => { if (model.dimensions[axis] > 0 && Number(value) > 0) updateScale(axis, Number(value) / model.dimensions[axis] * 100) }} /><label className="uniform-option"><input type="checkbox" checked={uniform} onChange={(event) => setUniform(event.target.checked)} /> Uniform scale</label></>}
    <div className="popover-footer"><span className="help-badge">?</span><button type="button" className="secondary small" onClick={applyAndClose}>Done</button></div>
  </div>
}

function VectorInputs({ label, unit, values, onChange, readOnly = false }) {
  return <div className="vector-inputs"><p>{label}</p><div className="axis-inputs">{['x', 'y', 'z'].map((axis) => <label key={axis}><span className={`axis-${axis}`}>{axis.toUpperCase()}</span><TransformNumber value={values[axis]} readOnly={readOnly} onChange={value => onChange?.(axis, value)} /></label>)}<em>{unit}</em></div></div>
}

function TransformNumber({ value, onChange, readOnly }) {
  const [draft, setDraft] = useState(String(value ?? 0))
  const editing = useRef(false)
  useEffect(() => { if (!editing.current) setDraft(Number(value || 0).toFixed(2)) }, [value])
  return <input type="number" step="0.01" value={draft} readOnly={readOnly} onFocus={() => { editing.current = true }} onChange={event => { const text = event.target.value; setDraft(text); if (text.trim() && Number.isFinite(Number(text))) onChange(Number(text)) }} onBlur={() => { editing.current = false; setDraft(Number(value || 0).toFixed(2)) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}

function FlushVolumesDialog({ filaments, settings = {}, onClose, onApply }) {
  const names = filaments.map((name, index) => name || `Filament ${index + 1}`)
  const count = Math.max(names.length, 1)
  const source = Array.isArray(settings.flush_volumes_matrix) ? settings.flush_volumes_matrix : String(settings.flush_volumes_matrix || '').split(/[;,\s]+/).filter(Boolean)
  const [matrix, setMatrix] = useState(() => Array.from({ length: count * count }, (_, index) => {
    const row = Math.floor(index / count), column = index % count
    if (row === column) return 0
    const value = Number(source[index])
    return Number.isFinite(value) ? value : 140
  }))
  const [multiplier, setMultiplier] = useState(Number(settings.flush_multiplier || 1))
  const [intoInfill, setIntoInfill] = useState(String(settings.flush_into_infill || '0') === '1')
  const [intoSupport, setIntoSupport] = useState(String(settings.flush_into_support || '0') === '1')

  function update(index, value) {
    setMatrix((current) => current.map((entry, position) => position === index ? Math.min(1000, Math.max(0, Number(value) || 0)) : entry))
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="settings-dialog flush-dialog" role="dialog" aria-modal="true" aria-label="Flush volumes">
      <header className="settings-dialog-header"><div><h2>Flush volumes</h2><p className="muted">Purging volume in mm³ when changing from the row filament to the column filament.</p></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      <div className="flush-matrix-scroll"><table className="flush-matrix"><thead><tr><th>From ↓ / To →</th>{names.map((name, index) => <th key={`${name}-${index}`}>{index + 1}<span>{name}</span></th>)}</tr></thead><tbody>{names.map((name, row) => <tr key={`${name}-${row}`}><th>{row + 1}<span>{name}</span></th>{names.map((_, column) => { const index = row * count + column; return <td key={column}><input aria-label={`Flush ${name} to ${names[column]}`} type="number" min="0" max="1000" step="1" value={matrix[index]} disabled={row === column} onChange={(event) => update(index, event.target.value)} /></td> })}</tr>)}</tbody></table></div>
      {count < 2 && <p className="muted flush-hint">Add another filament slot to configure a material change.</p>}
      <div className="flush-options"><label>Multiplier<input type="number" min="0" max="3" step="0.05" value={multiplier} onChange={(event) => setMultiplier(Math.min(3, Math.max(0, Number(event.target.value) || 0)))} /></label><label><input type="checkbox" checked={intoInfill} onChange={(event) => setIntoInfill(event.target.checked)} /> Flush into infill</label><label><input type="checkbox" checked={intoSupport} onChange={(event) => setIntoSupport(event.target.checked)} /> Flush into supports</label></div>
      <footer className="settings-dialog-footer"><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={() => onApply({ flush_volumes_matrix: matrix.map(String), flush_multiplier: String(multiplier), flush_into_infill: intoInfill ? '1' : '0', flush_into_support: intoSupport ? '1' : '0' })}>Apply</button></footer>
    </section>
  </div>
}

const processSettingGroups = {
  Quality: [
    ['Layer height', ['layer_height'], 'mm'],
    ['Initial layer height', ['initial_layer_height'], 'mm'],
    ['Default line width', ['line_width'], 'mm'],
    ['First layer line width', ['first_layer_line_width'], 'mm'],
    ['Outer wall line width', ['outer_wall_line_width'], 'mm'],
    ['Inner wall line width', ['inner_wall_line_width'], 'mm'],
    ['Top surface line width', ['top_surface_line_width'], 'mm'],
    ['Sparse infill line width', ['sparse_infill_line_width'], 'mm'],
    ['Wall loops', ['wall_loops', 'wall_count'], ''],
    ['Top shell layers', ['top_shell_layers', 'top_solid_layers'], ''],
    ['Bottom shell layers', ['bottom_shell_layers', 'bottom_solid_layers'], ''],
    ['Seam position', ['seam_position'], ''],
    ['Staggered inner seams', ['staggered_inner_seams'], ''],
    ['Seam gap', ['seam_gap'], '%'],
    ['Scarf joint seam', ['scarf_joint_seam'], ''],
    ['Role base wipe speed', ['role_base_wipe_speed'], 'mm/s'],
  ],
  Strength: [
    ['Sparse infill density', ['sparse_infill_density', 'fill_density'], '%'],
    ['Sparse infill pattern', ['sparse_infill_pattern', 'fill_pattern'], ''],
    ['Wall loops', ['wall_loops', 'wall_count'], ''],
    ['Top shell layers', ['top_shell_layers', 'top_solid_layers'], ''],
    ['Bottom shell layers', ['bottom_shell_layers', 'bottom_solid_layers'], ''],
  ],
  Speed: [
    ['Initial layer speed', ['initial_layer_speed'], 'mm/s'],
    ['Other layers speed', ['outer_wall_speed', 'inner_wall_speed'], 'mm/s'],
    ['Overhang speed', ['overhang_speed'], 'mm/s'],
    ['Travel speed', ['travel_speed'], 'mm/s'],
    ['Acceleration', ['default_acceleration'], 'mm/s²'],
  ],
  Support: [
    ['Support', ['enable_support', 'support_enable'], ''],
    ['Support type', ['support_type', 'support_structure'], ''],
    ['Support threshold angle', ['support_threshold_angle'], '°'],
    ['Brim width', ['brim_width'], 'mm'],
    ['Skirt loops', ['skirt_loops'], ''],
  ],
  Multimaterial: [
    ['Prime tower', ['prime_tower_enable'], ''],
    ['Filament for features', ['filament_type'], ''],
    ['Ooze prevention', ['ooze_prevention'], ''],
    ['Flush options', ['flush_volumes'], ''],
  ],
  Others: [
    ['Brim type', ['brim_type'], ''],
    ['Brim width', ['brim_width'], 'mm'],
    ['Skirt distance', ['skirt_distance'], 'mm'],
    ['Skirt loops', ['skirt_loops'], ''],
  ]
}

function ProcessSettings({ settings = {}, activeTab, onTabChange, mode, onModeChange, onEdit }) {
  const rows = processSettingGroups[activeTab] || processSettingGroups.Quality
  return <div className="process-settings"><div className="process-tabs" role="tablist" aria-label="Process settings">{Object.keys(processSettingGroups).map((tab) => <button type="button" key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => onTabChange(tab)}>{tab}</button>)}</div><div className="setting-rows">{rows.map(([label, keys, unit], index) => <React.Fragment key={label}>{(index === 0 || ['Default line width', 'Seam position', 'Sparse infill density', 'Initial layer speed', 'Support'].includes(label)) && <SettingGroupHeader title={groupTitle(label)} /> }<SettingRow label={label} onEdit={value => onEdit(keys[0], value)} value={findSetting(settings, keys)} unit={unit} modified={index % 5 === 0} /></React.Fragment>)}</div></div>
}

function groupTitle(label) {
  if (label.toLowerCase().includes('line width')) return 'Line width'
  if (label.toLowerCase().includes('seam')) return 'Seam'
  if (label.toLowerCase().includes('infill') || label.toLowerCase().includes('wall')) return 'Strength'
  if (label.toLowerCase().includes('speed') || label.toLowerCase().includes('acceleration')) return 'Speed'
  if (label.toLowerCase().includes('support')) return 'Support'
  return 'Layer height'
}

function SettingGroupHeader({ title }) {
  return <div className="setting-group-header"><Icon name={title === 'Line width' ? 'line-width' : title === 'Seam' ? 'seam' : 'settings-group'} size={15} /><strong>{title}</strong><span /></div>
}

function processTabIcon(tab) {
  return { Quality: 'quality', Strength: 'strength', Speed: 'speed', Support: 'support', Multimaterial: 'multimaterial', Others: 'others' }[tab] || 'objects'
}

function SettingRow({ label, value, unit, modified = false, onEdit }) {
  const display = value === undefined || value === null || value === '' ? '—' : Array.isArray(value) ? value.join(', ') : String(value)
  return <label className="setting-row"><span>{modified && <i className="modified-dot" />}{label}</span><span className="setting-value"><input value={display === '—' ? '' : display} placeholder="Inherited" onChange={event => onEdit?.(event.target.value)} aria-label={label} /><em>{unit}</em><button type="button" className="setting-reset" title="Reset to default" onClick={() => onEdit?.('')}>↶</button></span></label>
}

function findSetting(settings, keys) {
  for (const key of keys) {
    if (settings && settings[key] !== undefined) return Array.isArray(settings[key]) ? settings[key][0] : settings[key]
  }
  return undefined
}

function SummaryRow({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function EmptyPreview({ job, loading, uploadProgress, onCancel }) {
  const terminal = ['failed', 'dead-lettered', 'cancelled'].includes(job?.status)
  const uploading = uploadProgress !== null && uploadProgress !== undefined
  const status = uploading ? `Uploading model… ${uploadProgress}%` : loading ? 'Loading G-code preview…' : terminal ? `Slice ${job.status}` : job ? `Slice ${job.status} · attempt ${job.attempt_count}/${job.max_attempts}` : 'Prepare a model, then slice a plate'
  return <div className="empty-preview"><p className="eyebrow">Preview</p><h2>{status}</h2>{uploading && <progress max="100" value={uploadProgress} />}{job?.error_message && <p role="alert" className="error">{job.error_message}</p>}{job && !terminal && job.status !== 'completed' && <button onClick={onCancel}>Cancel slice</button>}{terminal && <p>Open Projects to retry this job or inspect its error.</p>}</div>
}

function WorkspacePlaceholder({ title }) {
  if (title === 'device') return <PrinterPanel />
  if (title === 'project' || title === 'home') return <JobsPanel />
  if (title === 'calibration') return <CalibrationTools />
  const label = title.charAt(0).toUpperCase() + title.slice(1)
  return <div className="workspace-placeholder"><Icon name={title === 'device' ? 'printer' : title === 'calibration' ? 'sliders' : 'objects'} size={28} /><p className="eyebrow">{label}</p><h2>{label} workspace</h2><p>This workspace is reserved for the corresponding OrcaSlicer workflow. Prepare and Preview are fully connected to the current PrintHub pipeline.</p></div>
}


function SpeedDial({ onClose, onAction }) {
  return <div className="speed-dial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="speed-dial" role="dialog" aria-label="Speed Dial"><div className="speed-dial-heading"><span>Speed Dial</span><kbd>Space</kbd></div><div className="speed-dial-grid"><button type="button" onClick={() => onAction('add')}><Icon name="add" size={22} /><span>Add model</span><kbd>Alt+1</kbd></button><button type="button" onClick={() => onAction('slice')}><Icon name="slice" size={22} /><span>Slice plate</span><kbd>Alt+2</kbd></button><button type="button" onClick={() => onAction('preview')}><Icon name="preview" size={22} /><span>Preview</span><kbd>Alt+3</kbd></button><button type="button" onClick={onClose}><Icon name="close" size={22} /><span>Close</span><kbd>Esc</kbd></button></div></section></div>
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function Icon({ name, size = 18 }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    project: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    device: <><path d="M6 8V3h12v5M6 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>,
    save: <><path d="M4 4h13l3 3v13H4z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    'chevron-left': <path d="m15 5-7 7 7 7" />,
    wifi: <><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0" /><circle cx="12" cy="20" r="1" /></>,
    transfer: <><path d="M4 7h13m0 0-3-3m3 3-3 3M20 17H7m0 0 3-3m-3 3 3 3" /></>,
    edit: <><path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4" /></>,
    'remove-all': <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /><path d="m9 12 6 6m0-6-6 6" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    'up-arrow': <><path d="M12 20V4m0 0-6 6m6-6 6 6M4 20h16" /></>,
    magnifier: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    plugin: <><path d="M9 3v4m6-4v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" /><path d="M8 21h8" /></>,
    'line-width': <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M7 4v4m5-4v4m5-4v4M7 16v4m5-4v4m5-4v4" /></>,
    seam: <><path d="M6 4v16M12 4v16M18 4v16" /><path d="M4 8h16M4 16h16" /></>,
    'settings-group': <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>,
    add: <><path d="M12 3v18M3 12h18" /><rect x="4" y="4" width="16" height="16" rx="2" /></>,
    delete: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5m4-5v5" /></>,
    'delete-all': <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5m4-5v5" /><path d="M3 21h18" /></>,
    orient: <><path d="M12 3v4m0 10v4M3 12h4m10 0h4" /><path d="m8 8 4-4 4 4M8 16l4 4 4-4" /></>,
    'add-plate': <><path d="m3 8 9 4 9-4-9-4zM3 8v8l9 4 9-4V8" /><path d="M19 15v6m-3-3h6" /></>,
    'split-parts': <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 3v18M4 7.5l8 4.5 8-4.5" /></>,
    sync: <><path d="M20 7a8 8 0 0 0-13.7-1.8L4 8m0 0V4m0 4h4M4 17a8 8 0 0 0 13.7 1.8L20 16m0 0v4m0-4h-4" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
    'eye-off': <><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3 3.7M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a9.7 9.7 0 0 0 3.2-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    quality: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="19" r="2" /></>,
    strength: <><path d="M4 20V10m5 10V4m5 16v-7m5 7V7" /></>,
    speed: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 12 4-4" /><path d="M6 19h12" /></>,
    support: <><path d="M5 20V8l7-4 7 4v12M5 12h14M9 20v-5h6v5" /></>,
    multimaterial: <><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="m9 9 6 6" /></>,
    others: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-17-7 2 2m10 10 2 2m0-14-2 2M8 17l-2 2" /></>,
    warning: <><path d="m12 3 10 18H2z" /><path d="M12 9v5m0 3h.01" /></>,
    calibration: <><path d="M4 19 19 4M8 4h4M4 8v4m16 4v4h-4" /><circle cx="7" cy="17" r="3" /><circle cx="17" cy="7" r="3" /></>,
    design: <><path d="m4 17 13-13 3 3L7 20H4z" /><path d="M12 6 18 12" /></>,
    slice: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="m8 3-3 3 3 3m8 3-3 3 3 3" /></>,
    preview: <><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></>,
    close: <><path d="m5 5 14 14M19 5 5 19" /></>,
    face: <><path d="m5 16 7 4 7-4V8l-7-4-7 4z" /><path d="m5 8 7 4 7-4M12 12v8" /></>,
    arrange: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /><path d="M10 7h8M17 7l-2-2m2 2-2 2M14 17H6M7 14l-2 3 2 3" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    move: <><path d="M12 3v18M3 12h18M12 3l-2 3m2-3 2 3M12 21l-2-3m2 3 2-3M3 12l3-2m-3 2 3 2M21 12l-3-2m3 2-3 2" /></>,
    rotate: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></>,
    scale: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><path d="m4 4 6 6m10-6-6 6m6 10-6-6M4 20l6-6" /></>,
    split: <><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="13" width="7" height="7" rx="1" /><path d="M10 7h5m0 0-2-2m2 2-2 2M14 17H9m0 0 2-2m-2 2 2 2" /></>,
    layers: <><path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4" /></>,
    cut: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="m8.5 7.5 11 11M8.5 16.5l4-4" /></>,
    measure: <><path d="m4 17 13-13 3 3L7 20H4z" /><path d="m9 12 2 2m1-5 2 2m1-5 2 2" /></>,
    meshboolean: <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /><path d="M12 8v8" /></>,
    supportpaint: <><path d="M5 20V8l7-4 7 4v12M5 12h14" /><path d="m8 16 8-8" /></>,
    seampaint: <><path d="M6 4v16M12 4v16M18 4v16" /><path d="M4 8h16M4 16h16" /></>,
    fuzzy: <><path d="M4 7h16M4 12h16M4 17h16" /><path d="m7 5-2 2 2 2m10 1-2 2 2 2m-8 1-2 2 2 2" /></>,
    mmu: <><path d="M5 5h14v14H5z" /><path d="M8 8h8v8H8zM5 12h3m8 0h3" /></>,
    text: <><path d="M5 5h14M12 5v14M8 19h8" /></>,
    assembly: <><path d="m5 12 4-4 4 4-4 4zM13 12l4-4 2 2-4 4z" /><path d="M4 20h16" /></>,
    brimears: <><path d="M4 18a8 8 0 0 1 16 0" /><path d="M7 18v3m5-3v3m5-3v3" /></>,
    printer: <><path d="M6 8V3h12v5M6 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM17 11h2" /></>,
    filament: <><circle cx="12" cy="12" r="8" /><path d="M12 4v16M8 7c2 2 6 2 8 0M8 17c2-2 6-2 8 0" /></>,
    process: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="3" /><path d="m5.6 5.6 2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2m-8.4 8.4-2.2 2.2" /></>,
    plate: <><path d="m3 8 9 4 9-4-9-4z" /><path d="M3 8v8l9 4 9-4V8M12 12v8" /></>,
    objects: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /></>,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>,
    chevron: <path d="m5 8 7 7 7-7" />
  }
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
