import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { changePassword } from '../api'
import { getMfaStatus, startMfaSetup, verifyMfaSetup, disableMfa } from '../cognito'

const ROLE_LABELS = { employee: 'Staff', support: 'Support Team', admin: 'Administrator' }

function Profile({ user }) {
  const [view, setView] = useState('profile') // 'profile' | 'settings'

  return (
    <div className="profile-container">
      <nav className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'profile'}
          className={`profile-tab ${view === 'profile' ? 'is-active' : ''}`}
          onClick={() => setView('profile')}
        >
          My Profile
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'settings'}
          className={`profile-tab ${view === 'settings' ? 'is-active' : ''}`}
          onClick={() => setView('settings')}
        >
          Settings
        </button>
      </nav>

      {view === 'profile' ? (
        <section className="profile-details">
          <div className="profile-avatar" aria-hidden="true">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <dl className="profile-fields">
            <div>
              <dt>Name</dt>
              <dd>{user?.name || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd><span className="profile-role-badge">{ROLE_LABELS[user?.role] || user?.role}</span></dd>
            </div>
          </dl>
        </section>
      ) : (
        <Settings />
      )}
    </div>
  )
}

function Settings() {
  return (
    <section className="settings-area">
      <ChangePasswordCard />
      <MfaCard />
    </section>
  )
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    // Match the Cognito pool password policy so the user gets a clear message
    // before submitting (12+ chars, upper, lower, number, symbol).
    const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/
    if (!policy.test(newPassword)) {
      setError('New password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }
    setSubmitting(true)
    try {
      // changePassword now goes through Cognito and resolves on success.
      await changePassword(currentPassword, newPassword)
      setNotice('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (changeError) {
      setError(changeError.message || 'Could not change your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="settings-card">
      <h3>Change password</h3>
      <p className="settings-card-hint">Use at least 12 characters.</p>
      <form className="ticket-form" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error-box"><strong>Unable to change password</strong><span>{error}</span></div>}
        {notice && <p className="settings-notice" role="status">{notice}</p>}
        <button type="submit" className="submit-button" disabled={submitting}>
          {submitting ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

function MfaCard() {
  const [status, setStatus] = useState('loading') // loading | on | off | error
  const [stage, setStage] = useState('idle') // idle | enrolling
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshStatus = async () => {
    try {
      const { enabled } = await getMfaStatus()
      setStatus(enabled ? 'on' : 'off')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const beginSetup = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { secret: s, otpauthUrl } = await startMfaSetup()
      setSecret(s)
      setQrDataUrl(await QRCode.toDataURL(otpauthUrl))
      setStage('enrolling')
    } catch (e) {
      setError(e.message || 'Could not start MFA setup.')
    } finally {
      setBusy(false)
    }
  }

  const confirmSetup = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyMfaSetup(code)
      setNotice('Multi-factor authentication is now enabled.')
      setStage('idle')
      setCode('')
      setSecret('')
      setQrDataUrl('')
      await refreshStatus()
    } catch (e) {
      setError(e.message || 'Could not verify the code.')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await disableMfa()
      setNotice('Multi-factor authentication has been disabled.')
      await refreshStatus()
    } catch (e) {
      setError(e.message || 'Could not disable MFA.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-card">
      <h3>Multi-factor authentication (MFA)</h3>
      <p className="settings-card-hint">
        Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, etc.).
      </p>

      {status === 'loading' && <p className="settings-card-hint">Checking MFA status…</p>}

      {status === 'on' && stage === 'idle' && (
        <>
          <p className="mfa-status mfa-on">✓ MFA is enabled on your account.</p>
          <button type="button" className="secondary-button" onClick={turnOff} disabled={busy}>
            {busy ? 'Working…' : 'Disable MFA'}
          </button>
        </>
      )}

      {status === 'off' && stage === 'idle' && (
        <>
          <p className="mfa-status mfa-off">MFA is not enabled.</p>
          <button type="button" className="submit-button" onClick={beginSetup} disabled={busy}>
            {busy ? 'Starting…' : 'Set up MFA'}
          </button>
        </>
      )}

      {stage === 'enrolling' && (
        <div className="mfa-enroll">
          <p className="settings-card-hint">1. Scan this QR code in your authenticator app:</p>
          {qrDataUrl && <img className="mfa-qr" src={qrDataUrl} alt="MFA QR code" />}
          <p className="settings-card-hint">Or enter this key manually:</p>
          <code className="mfa-secret">{secret}</code>
          <form className="ticket-form" onSubmit={confirmSetup}>
            <div className="form-group">
              <label htmlFor="mfa-code">2. Enter the 6-digit code from the app</label>
              <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button type="submit" className="submit-button" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify and enable'}
            </button>
            <button type="button" className="secondary-button" onClick={() => { setStage('idle'); setError('') }} disabled={busy}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {status === 'error' && <p className="settings-card-hint">Could not load MFA status. Try signing in again.</p>}
      {error && <div className="error-box"><strong>MFA error</strong><span>{error}</span></div>}
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </div>
  )
}

export default Profile
