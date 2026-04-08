import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = [
  '#7c6af7', '#3ecf8e', '#f46a6a', '#f59e0b',
  '#38bdf8', '#e879f9', '#fb923c', '#a3e635'
]

const CACHE_KEY = 'ft_cache'
const PENDING_KEY = 'ft_pending'

function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtHours(seconds) {
  return (seconds / 3600).toFixed(1) + 'h'
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ── Cache helpers ─────────────────────────────────────────────────────
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function writeCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data))
}
function readPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] }
}
function writePending(ops) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(ops))
}
function addPending(op) {
  writePending([...readPending(), op])
}

export default function Tracker() {
  const [projects, setProjects] = useState([])
  const [allTotals, setAllTotals] = useState({})     // { pid: seconds } tutto il tempo (entry chiuse)
  const [todayTotals, setTodayTotals] = useState({}) // { pid: seconds } oggi (entry chiuse)
  const [timers, setTimers] = useState({})            // { pid: { startMs, entryId, elapsed } }
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedColor, setSelectedColor] = useState(0)
  const intervalsRef = useRef({})

  useEffect(() => {
    loadData()
    return () => { Object.values(intervalsRef.current).forEach(clearInterval) }
  }, [])

  useEffect(() => {
    window.addEventListener('online', syncPending)
    return () => window.removeEventListener('online', syncPending)
  }, [])

  // ── Sync pending ops ──────────────────────────────────────────────────
  async function syncPending() {
    const ops = readPending()
    if (!ops.length) return
    const failed = []
    for (const op of ops) {
      try {
        if (op.type === 'insert_project') await supabase.from('projects').insert(op.data)
        else if (op.type === 'insert_entry') await supabase.from('time_entries').insert(op.data)
        else if (op.type === 'update_entry') await supabase.from('time_entries').update(op.data).eq('id', op.id)
        else if (op.type === 'delete_project') await supabase.from('projects').delete().eq('id', op.id)
      } catch { failed.push(op) }
    }
    writePending(failed)
    if (!failed.length) { setOffline(false); loadData() }
  }

  // ── Load data — ricostruisce i timer aperti dal DB ─────────────────────
  async function loadData() {
    setLoading(true)

    const { data: projs, error } = await supabase
      .from('projects').select('*').order('created_at', { ascending: true })

    if (error || !projs) {
      // Offline: usa cache e ricostruisce timer da localStorage
      const cache = readCache()
      if (cache) {
        setProjects(cache.projects || [])
        setAllTotals(cache.allTotals || {})
        setTodayTotals(cache.todayTotals || {})
        // Ricostruisci timer aperti da cache
        if (cache.openTimers) restoreTimers(cache.openTimers)
        setOffline(true)
      }
      setLoading(false)
      return
    }

    // Totali entry CHIUSE — tutto il tempo
    const { data: allEntries } = await supabase
      .from('time_entries').select('project_id, duration').not('ended_at', 'is', null)

    const aTotals = {}
    allEntries?.forEach(e => { aTotals[e.project_id] = (aTotals[e.project_id] || 0) + (e.duration || 0) })

    // Totali entry CHIUSE — solo oggi
    const { data: todayEntries } = await supabase
      .from('time_entries').select('project_id, duration')
      .not('ended_at', 'is', null).gte('started_at', todayStart())

    const tTotals = {}
    todayEntries?.forEach(e => { tTotals[e.project_id] = (tTotals[e.project_id] || 0) + (e.duration || 0) })

    // Entry APERTE (ended_at IS NULL) → timer ancora in corso
    // Queste sono sessioni avviate e mai chiuse — riprende il conto da started_at
    const { data: openEntries } = await supabase
      .from('time_entries').select('id, project_id, started_at').is('ended_at', null)

    const openTimers = {}
    openEntries?.forEach(e => {
      openTimers[e.project_id] = { entryId: e.id, startedAt: e.started_at }
    })

    setProjects(projs)
    setAllTotals(aTotals)
    setTodayTotals(tTotals)
    setOffline(false)

    writeCache({ projects: projs, allTotals: aTotals, todayTotals: tTotals, openTimers })

    // Riavvia i timer aperti
    restoreTimers(openTimers)

    setLoading(false)
  }

  // ── Ricostruisce i timer da { pid: { entryId, startedAt } } ──────────
  function restoreTimers(openTimers) {
    // Pulisci eventuali timer precedenti
    Object.values(intervalsRef.current).forEach(clearInterval)
    intervalsRef.current = {}

    const restoredTimers = {}
    Object.entries(openTimers).forEach(([pid, { entryId, startedAt }]) => {
      const startMs = new Date(startedAt).getTime()
      const elapsed = Math.floor((Date.now() - startMs) / 1000)
      restoredTimers[pid] = { startMs, entryId, elapsed }
      // Avvia il tick
      intervalsRef.current[pid] = setInterval(() => {
        setTimers(prev => ({
          ...prev,
          [pid]: { ...prev[pid], elapsed: Math.floor((Date.now() - startMs) / 1000) }
        }))
      }, 1000)
    })
    setTimers(restoredTimers)
  }

  // ── Timer tick per nuove sessioni ─────────────────────────────────────
  function startTicking(projectId, startMs) {
    if (intervalsRef.current[projectId]) clearInterval(intervalsRef.current[projectId])
    intervalsRef.current[projectId] = setInterval(() => {
      setTimers(prev => ({
        ...prev,
        [projectId]: { ...prev[projectId], elapsed: Math.floor((Date.now() - startMs) / 1000) }
      }))
    }, 1000)
  }

  // ── Clock in / out ────────────────────────────────────────────────────
  async function toggleTimer(project) {
    const pid = project.id

    if (timers[pid]) {
      // ── Clock OUT ──
      const { startMs, entryId } = timers[pid]
      const endedAt = new Date().toISOString()
      const duration = Math.floor((Date.now() - startMs) / 1000)

      clearInterval(intervalsRef.current[pid])
      delete intervalsRef.current[pid]

      const { error } = await supabase
        .from('time_entries').update({ ended_at: endedAt, duration }).eq('id', entryId)
      if (error) { addPending({ type: 'update_entry', id: entryId, data: { ended_at: endedAt, duration } }); setOffline(true) }

      setAllTotals(prev => ({ ...prev, [pid]: (prev[pid] || 0) + duration }))
      setTodayTotals(prev => ({ ...prev, [pid]: (prev[pid] || 0) + duration }))
      setTimers(prev => { const n = { ...prev }; delete n[pid]; return n })

      // Aggiorna cache rimuovendo il timer aperto
      const cache = readCache()
      if (cache?.openTimers) {
        delete cache.openTimers[pid]
        writeCache(cache)
      }

    } else {
      // ── Clock IN ──
      const startMs = Date.now()
      const startedAt = new Date(startMs).toISOString()
      const tempId = 'local_' + startMs

      const { data: entry, error } = await supabase
        .from('time_entries').insert({ project_id: pid, started_at: startedAt }).select().single()

      if (error) {
        addPending({ type: 'insert_entry', data: { id: tempId, project_id: pid, started_at: startedAt } })
        setOffline(true)
      }

      const entryId = entry?.id ?? tempId

      // Salva il timer aperto in cache così sopravvive alla chiusura della PWA
      const cache = readCache() || {}
      cache.openTimers = { ...(cache.openTimers || {}), [pid]: { entryId, startedAt } }
      writeCache(cache)

      setTimers(prev => ({ ...prev, [pid]: { startMs, entryId, elapsed: 0 } }))
      startTicking(pid, startMs)
    }
  }

  // ── Add project ───────────────────────────────────────────────────────
  async function addProject() {
    const name = newName.trim()
    if (!name) return
    const color = COLORS[selectedColor]

    const { data, error } = await supabase.from('projects').insert({ name, color }).select().single()
    const newProject = data ?? { id: 'local_' + Date.now(), name, color, created_at: new Date().toISOString() }

    if (error) { addPending({ type: 'insert_project', data: { name, color } }); setOffline(true) }

    setProjects(prev => [...prev, newProject])
    setNewName('')
    setSelectedColor(0)
    setShowModal(false)
  }

  // ── Delete project ─────────────────────────────────────────────────────
  async function deleteProject(pid) {
    if (!confirm('Eliminare il progetto? Tutti i dati di tempo verranno persi.')) return
    if (timers[pid]) { clearInterval(intervalsRef.current[pid]); delete intervalsRef.current[pid] }

    const { error } = await supabase.from('projects').delete().eq('id', pid)
    if (error) { addPending({ type: 'delete_project', id: pid }); setOffline(true) }

    setProjects(prev => prev.filter(p => p.id !== pid))
    setTimers(prev => { const n = { ...prev }; delete n[pid]; return n })
    setAllTotals(prev => { const n = { ...prev }; delete n[pid]; return n })
    setTodayTotals(prev => { const n = { ...prev }; delete n[pid]; return n })
  }

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Progetti</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {offline && (
            <span style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '4px 10px' }}>
              ⚠ offline — dati in cache
            </span>
          )}
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Nuovo progetto
          </button>
        </div>
      </div>

      <div className="projects-grid">
        {projects.length === 0 && (
          <div className="empty-state">
            <p>Nessun progetto ancora.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Crea il primo progetto</button>
          </div>
        )}

        {projects.map(p => {
          const isActive = !!timers[p.id]
          const elapsed = timers[p.id]?.elapsed ?? 0
          // Counter grande = oggi completato + sessione attiva corrente
          const todayDisplay = (todayTotals[p.id] || 0) + elapsed
          // Totale storico = tutto + sessione attiva corrente
          const grandTotal = (allTotals[p.id] || 0) + elapsed

          return (
            <div key={p.id} className={`project-card ${isActive ? 'clocked-in' : ''}`}>
              <div className="project-card-header">
                <div className="project-info">
                  <span className="project-color-dot" style={{ background: p.color }} />
                  <span className="project-name">{p.name}</span>
                </div>
                {isActive
                  ? <span className="live-badge"><span className="live-dot" />live</span>
                  : <button className="btn btn-danger" onClick={() => deleteProject(p.id)}>×</button>
                }
              </div>

              <div className="project-total">Totale: {fmtHours(grandTotal)}</div>
              <div className="timer-display">{fmtTime(todayDisplay)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: '0.75rem', marginTop: '-0.5rem' }}>
                ore lavorate oggi
              </div>

              <button className={`clock-btn ${isActive ? 'active' : ''}`} onClick={() => toggleTimer(p)}>
                {isActive ? '⏹ Clock Out' : '▶ Clock In'}
              </button>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2 className="modal-title">Nuovo progetto</h2>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="form-input"
                type="text"
                placeholder="Es. Cliente Rossi – E-commerce"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addProject()}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Colore</label>
              <div className="color-grid">
                {COLORS.map((c, i) => (
                  <div key={c} className={`color-swatch ${selectedColor === i ? 'selected' : ''}`}
                    style={{ background: c }} onClick={() => setSelectedColor(i)} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="btn btn-primary" onClick={addProject}>Crea</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}