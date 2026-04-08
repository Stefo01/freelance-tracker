import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtHours(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function getDateRange(period, dateFrom, dateTo) {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from: start.toISOString(), to: now.toISOString() }
  }
  if (period === 'week') return { from: new Date(now - 7 * 86400000).toISOString(), to: now.toISOString() }
  if (period === 'month') return { from: new Date(now - 30 * 86400000).toISOString(), to: now.toISOString() }
  if (period === 'year') return { from: new Date(now - 365 * 86400000).toISOString(), to: now.toISOString() }
  if (period === 'custom') {
    return {
      from: dateFrom ? new Date(dateFrom).toISOString() : null,
      to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null
    }
  }
  return { from: null, to: null }
}

export default function Report({ userId }) {
  const [projects, setProjects] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Carica prima i progetti, poi subito dopo il report
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('projects').select('*').order('created_at')
      const projs = data || []
      setProjects(projs)
      await loadReport(projs, filterProject, filterPeriod, dateFrom, dateTo)
    }
    init()
  }, [])

  // Ricarica il report al cambio filtri (projects già disponibili)
  useEffect(() => {
    if (!projects.length && filterPeriod === 'month' && filterProject === 'all') return // skip primo render
    loadReport(projects, filterProject, filterPeriod, dateFrom, dateTo)
  }, [filterProject, filterPeriod, dateFrom, dateTo])

  async function loadReport(projs, fprojekt, fperiod, dfrom, dto) {
    setLoading(true)
    const { from, to } = getDateRange(fperiod, dfrom, dto)

    let query = supabase
      .from('time_entries')
      .select('project_id, duration, started_at')
      .not('ended_at', 'is', null)

    if (from) query = query.gte('started_at', from)
    if (to)   query = query.lte('started_at', to)
    if (fprojekt !== 'all') query = query.eq('project_id', fprojekt)

    const { data: entries, error } = await query
    if (error) { console.error(error); setLoading(false); return }

    const map = {}
    entries?.forEach(e => {
      if (!map[e.project_id]) map[e.project_id] = { totalSeconds: 0, sessions: 0 }
      map[e.project_id].totalSeconds += e.duration || 0
      map[e.project_id].sessions += 1
    })

    const relevantProjects = fprojekt === 'all' ? projs : projs.filter(p => p.id === fprojekt)
    const result = relevantProjects
      .map(p => ({ project: p, ...(map[p.id] || { totalSeconds: 0, sessions: 0 }) }))
      .filter(r => r.totalSeconds > 0)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)

    setRows(result)
    setLoading(false)
  }

  function onFilterChange(setter, value, key) {
    setter(value)
    const state = {
      fprojekt: filterProject,
      fperiod: filterPeriod,
      dfrom: dateFrom,
      dto: dateTo,
      [key]: value
    }
    loadReport(projects, state.fprojekt, state.fperiod, state.dfrom, state.dto)
  }

  const totalSeconds = rows.reduce((s, r) => s + r.totalSeconds, 0)
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0)

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Resoconto</h1>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label className="filter-label">Progetto</label>
          <select className="filter-select" value={filterProject}
            onChange={e => { setFilterProject(e.target.value); onFilterChange(setFilterProject, e.target.value, 'fprojekt') }}>
            <option value="all">Tutti i progetti</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Periodo</label>
          <select className="filter-select" value={filterPeriod}
            onChange={e => { setFilterPeriod(e.target.value); onFilterChange(setFilterPeriod, e.target.value, 'fperiod') }}>
            <option value="all">Sempre</option>
            <option value="today">Oggi</option>
            <option value="week">Ultima settimana</option>
            <option value="month">Ultimo mese</option>
            <option value="year">Ultimo anno</option>
            <option value="custom">Personalizzato</option>
          </select>
        </div>

        {filterPeriod === 'custom' && (
          <>
            <div className="filter-group">
              <label className="filter-label">Dal</label>
              <input className="filter-input" type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); onFilterChange(setDateFrom, e.target.value, 'dfrom') }} />
            </div>
            <div className="filter-group">
              <label className="filter-label">Al</label>
              <input className="filter-input" type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); onFilterChange(setDateTo, e.target.value, 'dto') }} />
            </div>
          </>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Ore totali</div>
          <div className="stat-value">{fmtHours(totalSeconds)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sessioni</div>
          <div className="stat-value">{totalSessions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Progetti</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Progetto</th>
              <th>Sessioni</th>
              <th>Ore totali</th>
              <th>% sul totale</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4}><div className="spinner" /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="no-data">Nessun dato per il periodo selezionato.</td></tr>
            )}
            {!loading && rows.map(({ project: p, totalSeconds: sec, sessions }) => {
              const pct = totalSeconds > 0 ? Math.round(sec / totalSeconds * 100) : 0
              return (
                <tr key={p.id}>
                  <td>
                    <div className="project-label">
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                      {p.name}
                    </div>
                  </td>
                  <td>{sessions}</td>
                  <td><span className="hours-mono">{fmtHours(sec)}</span></td>
                  <td>
                    <div className="bar-wrap">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: pct + '%', background: p.color }} />
                      </div>
                      <span className="bar-pct">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}