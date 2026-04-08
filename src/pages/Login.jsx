import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [mode, setMode] = useState('login')        // 'login' | 'signup' | 'verify'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!email || !password) { setError('Compila tutti i campi.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Credenziali non valide.')
    setLoading(false)
  }

  async function handleSignup() {
    setError('')
    if (!email || !password) { setError('Compila tutti i campi.'); return }
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    setMode('verify')
    setLoading(false)
  }

  async function handleVerify() {
    setError('')
    if (!otp) { setError('Inserisci il codice.'); return }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'signup' })
    if (error) setError('Codice non valido o scaduto.')
    setLoading(false)
  }

  async function handleResend() {
    setError('')
    setLoading(true)
    await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
  }

  // ── Schermata verifica OTP ────────────────────────────────────────────
  if (mode === 'verify') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={brandStyle}>
            <span style={dotStyle} />
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.3px' }}>FreelanceTracker</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Conferma account</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
            Abbiamo inviato un codice a <strong>{email}</strong>. Copialo qui sotto.
          </p>

          <div className="form-group">
            <label className="form-label">Codice di conferma</label>
            <input
              className="form-input"
              type="text"
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
              maxLength={6}
              autoFocus
            />
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button className="btn btn-primary" style={fullBtnStyle} onClick={handleVerify} disabled={loading}>
            {loading ? '...' : 'Conferma'}
          </button>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
            Non hai ricevuto nulla?{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={handleResend}>
              Reinvia codice
            </span>
          </p>
        </div>
      </div>
    )
  }

  // ── Schermata login / signup ──────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          <span style={dotStyle} />
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
            onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
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
            onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
          />
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <button
          className="btn btn-primary"
          style={fullBtnStyle}
          onClick={mode === 'login' ? handleLogin : handleSignup}
          disabled={loading}
        >
          {loading ? '...' : mode === 'login' ? 'Accedi' : 'Crea account'}
        </button>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
          {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </span>
        </p>
      </div>
    </div>
  )
}

// ── Stili inline condivisi ────────────────────────────────────────────
const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  padding: '1rem'
}
const cardStyle = {
  background: 'var(--bg2)',
  border: '1px solid var(--border-md)',
  borderRadius: 'var(--radius)',
  padding: '2rem',
  width: '100%',
  maxWidth: 380
}
const brandStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: '2rem'
}
const dotStyle = {
  width: 8, height: 8,
  borderRadius: '50%',
  background: 'var(--accent)',
  boxShadow: '0 0 8px var(--accent)',
  display: 'inline-block'
}
const errorStyle = {
  fontSize: 13,
  color: '#f46a6a',
  background: 'rgba(244,106,106,0.08)',
  border: '1px solid rgba(244,106,106,0.2)',
  borderRadius: 6,
  padding: '8px 12px',
  marginBottom: '1rem'
}
const fullBtnStyle = {
  width: '100%',
  justifyContent: 'center',
  padding: '10px',
  marginBottom: '0.5rem'
}