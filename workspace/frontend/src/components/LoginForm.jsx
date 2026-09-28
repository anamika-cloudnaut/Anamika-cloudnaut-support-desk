import { useState } from 'react'
import { apiFetch } from '../api'

const roleNames = {
  employee: 'Staff',
  support: 'Support Team',
  admin: 'Admin',
}

function LoginForm({ role, onLogin, onBackToRoles, onSignUp, onForgotPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Sign-in failed.')
      if (data.user.role !== role) {
        throw new Error(`This account is registered for ${roleNames[data.user.role] || data.user.role}. Choose that sign-in option instead.`)
      }
      onLogin(data)
    } catch (loginError) {
      setError(loginError.message || 'Could not connect to the service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ticket-form-card auth-card">
      <span className="section-label">{roleNames[role]?.toUpperCase()} ACCESS</span>
      <h2>{roleNames[role]} sign in</h2>
      <p>Use your work account to access support requests.</p>
      <form className="ticket-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-email">Work email</label>
          <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <div className="error-box"><strong>Unable to sign in</strong><span>{error}</span></div>}
        <button type="submit" className="submit-button" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
        <button type="button" className="secondary-button login-back-button" onClick={onBackToRoles}>
          Choose a different role
        </button>
        {role !== 'admin' && (
          <p className="auth-signup-prompt">
            Need an account? <button type="button" className="auth-link" onClick={onSignUp}>Sign up</button>
          </p>
        )}
        <p className="auth-signup-prompt">
          <button type="button" className="auth-link" onClick={onForgotPassword}>Forgot password?</button>
        </p>
      </form>
    </section>
  )
}

export default LoginForm
