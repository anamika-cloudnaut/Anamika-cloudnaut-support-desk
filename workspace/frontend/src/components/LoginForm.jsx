import { useState } from 'react'
import { signIn, completeNewPassword, sendMfaCode } from '../cognito'

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

  // Force-password-change state (migrated / first-time users).
  const [challenge, setChallenge] = useState(null) // { cognitoUser, userAttributes }
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // MFA login-challenge state.
  const [mfaUser, setMfaUser] = useState(null) // cognitoUser awaiting a TOTP code
  const [mfaCode, setMfaCode] = useState('')

  const finish = (result) => {
    if (result.user.role !== role) {
      setError(`This account is registered for ${roleNames[result.user.role] || result.user.role}. Choose that sign-in option instead.`)
      return
    }
    onLogin({ access_token: result.idToken, user: result.user })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await signIn(email, password)
      if (result.status === 'NEW_PASSWORD_REQUIRED') {
        setChallenge({ cognitoUser: result.cognitoUser, userAttributes: result.userAttributes })
      } else if (result.status === 'MFA_REQUIRED') {
        setMfaUser(result.cognitoUser)
      } else {
        finish(result)
      }
    } catch (loginError) {
      setError(loginError.message || 'Could not connect to the service.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewPassword = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const result = await completeNewPassword(challenge.cognitoUser, newPassword, challenge.userAttributes)
      finish(result)
    } catch (changeError) {
      setError(changeError.message || 'Could not set the new password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMfaSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await sendMfaCode(mfaUser, mfaCode)
      finish(result)
    } catch (mfaError) {
      setError(mfaError.message || 'Could not verify the code.')
    } finally {
      setSubmitting(false)
    }
  }

  if (mfaUser) {
    return (
      <section className="ticket-form-card auth-card">
        <span className="section-label">TWO-STEP VERIFICATION</span>
        <h2>Enter your code</h2>
        <p>Open your authenticator app and enter the current 6-digit code.</p>
        <form className="ticket-form" onSubmit={handleMfaSubmit}>
          <div className="form-group">
            <label htmlFor="mfa-login-code">6-digit code</label>
            <input id="mfa-login-code" type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} />
          </div>
          {error && <div className="error-box"><strong>Verification failed</strong><span>{error}</span></div>}
          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" className="secondary-button" onClick={() => { setMfaUser(null); setMfaCode(''); setError('') }}>
            Back to sign in
          </button>
        </form>
      </section>
    )
  }

  if (challenge) {
    return (
      <section className="ticket-form-card auth-card">
        <span className="section-label">SET A NEW PASSWORD</span>
        <h2>Choose a new password</h2>
        <p>Your account requires a new password before you can continue.</p>
        <form className="ticket-form" onSubmit={handleNewPassword}>
          <div className="form-group">
            <label htmlFor="np-new">New password</label>
            <input id="np-new" type="password" autoComplete="new-password" minLength={12} required
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="np-confirm">Confirm new password</label>
            <input id="np-confirm" type="password" autoComplete="new-password" minLength={12} required
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && <div className="error-box"><strong>Unable to set password</strong><span>{error}</span></div>}
          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? 'Saving...' : 'Set password and continue'}
          </button>
        </form>
      </section>
    )
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
