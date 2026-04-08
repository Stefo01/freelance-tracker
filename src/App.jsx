import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Tracker from './pages/Tracker'
import Report from './pages/Report'
import Login from './pages/Login'
import './App.css'

export default function App() {
  const [session, setSession] = useState(undefined)  // undefined = loading, null = no session
  const [page, setPage] = useState('tracker')

  useEffect(() => {
    // Leggi la sessione corrente
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
    })

    // Ascolta cambiamenti di sessione (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('ft_cache')
    localStorage.removeItem('ft_pending')
  }

  // Loading iniziale
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Non autenticato
  if (!session) return <Login />

  // Autenticato
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot" />
          <span className="brand-name">FreelanceTracker</span>
        </div>
        <nav className="topbar-nav">
          <button className={`nav-btn ${page === 'tracker' ? 'active' : ''}`} onClick={() => setPage('tracker')}>
            Tracker
          </button>
          <button className={`nav-btn ${page === 'report' ? 'active' : ''}`} onClick={() => setPage('report')}>
            Resoconto
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{session.user.email}</span>
          <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={handleLogout}>
            Esci
          </button>
        </div>
      </header>
      <main className="main-content">
        {page === 'tracker' ? <Tracker userId={session.user.id} /> : <Report userId={session.user.id} />}
      </main>
    </div>
  )
}