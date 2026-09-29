import { useState } from 'react'
import { apiFetch } from '../api'

function PasswordResetForm({ token, onComplete }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not reset password.')
      setComplete(true)
    } catch (resetError) {
      setError(resetError.message || 'Could not connect to the service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ticket-form-card auth-card">
      <span className="section-label">PASSWORD RECOVERY</span>
      <h2>{complete ? 'Password updated' : 'Choose a new password'}</h2>
      {complete ? (
        <>
          <p>Your password has been changed. Sign in with your new password.</p>
          <button type="button" className="submit-button" onClick={onComplete}>Back to sign in</button>
        </>
      ) : (
        <form className="ticket-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength="6" maxLength="200" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength="6" maxLength="200" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          {error && <div className="error-box"><strong>Unable to reset password</strong><span>{error}</span></div>}
          <button type="submit" className="submit-button" disabled={submitting}>{submitting ? 'Updating...' : 'Update password'}</button>
        </form>
      )}
    </section>
  )
}

export default PasswordResetForm