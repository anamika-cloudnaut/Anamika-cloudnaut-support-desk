import { useState } from 'react'
import { forgotPassword, confirmForgotPassword } from '../cognito'

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState('request') // 'request' | 'confirm' | 'done'

  const requestCode = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await forgotPassword(email)
      setStage('confirm')
    } catch (requestError) {
      setError(requestError.message || 'Could not start password reset.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirm = async (event) => {
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
      await confirmForgotPassword(email, code.trim(), newPassword)
      setStage('done')
    } catch (confirmError) {
      setError(confirmError.message || 'Could not reset the password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="ticket-form-card auth-card">
      <span className="section-label">PASSWORD RECOVERY</span>

      {stage === 'done' ? (
        <>
          <h2>Password updated</h2>
          <p>You can now sign in with your new password.</p>
          <button type="button" className="secondary-button" onClick={onBack}>Back to sign in</button>
        </>
      ) : stage === 'confirm' ? (
        <>
          <h2>Enter the code</h2>
          <form className="ticket-form" onSubmit={confirm}>
            <p>We emailed a verification code to <strong>{email}</strong>. Enter it with your new password.</p>
            <div className="form-group">
              <label htmlFor="reset-code">Verification code</label>
              <input id="reset-code" type="text" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="reset-new">New password</label>
              <input id="reset-new" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="reset-confirm">Confirm new password</label>
              <input id="reset-confirm" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {error && <div className="error-box"><strong>Unable to reset</strong><span>{error}</span></div>}
            <button type="submit" className="submit-button" disabled={submitting}>{submitting ? 'Updating...' : 'Reset password'}</button>
            <button type="button" className="secondary-button" onClick={onBack}>Back to sign in</button>
          </form>
        </>
      ) : (
        <>
          <h2>Forgot password?</h2>
          <form className="ticket-form" onSubmit={requestCode}>
            <p>Enter your account email and we’ll send a verification code.</p>
            <div className="form-group">
              <label htmlFor="forgot-email">Work email</label>
              <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {error && <div className="error-box"><strong>Unable to request reset</strong><span>{error}</span></div>}
            <button type="submit" className="submit-button" disabled={submitting}>{submitting ? 'Sending...' : 'Send code'}</button>
            <button type="button" className="secondary-button" onClick={onBack}>Back to sign in</button>
          </form>
        </>
      )}
    </section>
  )
}

export default ForgotPasswordForm
