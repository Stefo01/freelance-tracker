import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')   // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setError('')
    setMessage('')
    if (!email || !password) { setError('Compila tutti i campi.'); return }
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Credenziali non valide.')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Account creato! Controlla la mail per confermare, poi accedi.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius)',
        padding: '2rem',
        width: '100%',
        maxWidth: 380
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>FreelanceTracker</span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
          {mode === 'login' ? 'Accedi' : 'Crea account'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
          {mode === 'login' ? 'Bentornato.' : 'Inizia a tracciare il tuo tempo.'}
        </p>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="tu@esempio.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#f46a6a', background: 'rgba(244,106,106,0.08)', border: '1px solid rgba(244,106,106,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ fontSize: 13, color: '#3ecf8e', background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: '1rem' }}>
            {message}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px', marginBottom: '1rem' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '...' : mode === 'login' ? 'Accedi' : 'Crea account'}
        </button>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </span>
        </p>
      </div>
    </div>
  )
}