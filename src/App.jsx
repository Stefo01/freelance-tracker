import { useState } from 'react'
import Tracker from './pages/Tracker'
import Report from './pages/Report'
import './App.css'

export default function App() {
  const [page, setPage] = useState('tracker')

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot" />
          <span className="brand-name">FreelanceTracker</span>
        </div>
        <nav className="topbar-nav">
          <button
            className={`nav-btn ${page === 'tracker' ? 'active' : ''}`}
            onClick={() => setPage('tracker')}
          >
            Tracker
          </button>
          <button
            className={`nav-btn ${page === 'report' ? 'active' : ''}`}
            onClick={() => setPage('report')}
          >
            Resoconto
          </button>
        </nav>
      </header>
      <main className="main-content">
        {page === 'tracker' ? <Tracker /> : <Report />}
      </main>
    </div>
  )
}