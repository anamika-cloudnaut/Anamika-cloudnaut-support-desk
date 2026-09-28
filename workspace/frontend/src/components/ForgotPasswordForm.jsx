import { useState } from 'react'
import { apiFetch } from '../api'

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not request a password reset.')
      setSubmitted(true)
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ticket-form-card auth-card">
      <span className="section-label">PASSWORD RECOVERY</span>
      <h2>{submitted ? 'Check your email' : 'Forgot password?'}</h2>
      {submitted ? (
        <>
          <p>If an active account uses that email, password reset instructions have been sent.</p>
          <button type="button" className="secondary-button" onClick={onBack}>Back to sign in</button>
        </>
      ) : (
        <form className="ticket-form" onSubmit={handleSubmit}>
          <p>Enter your account email and we’ll send a password reset link.</p>
          <div className="form-group">
            <label htmlFor="forgot-email">Work email</label>
            <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {error && <div className="error-box"><strong>Unable to request reset</strong><span>{error}</span></div>}
          <button type="submit" className="submit-button" disabled={submitting}>{submitting ? 'Sending...' : 'Send reset link'}</button>
          <button type="button" className="secondary-button" onClick={onBack}>Back to sign in</button>
        </form>
      )}
    </section>
  )
}

export default ForgotPasswordForm