import { useState } from 'react'
import { apiFetch } from '../api'

function SignupForm({ initialRole, onBackToLogin, onForgotPassword }) {
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [role, setRole] = useState(initialRole === 'support' ? 'support' : 'employee')
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const [submitting, setSubmitting] = useState(false)

	const handleSubmit = async (event) => {
		event.preventDefault()
		setSubmitting(true)
		setError('')
		try {
			const response = await apiFetch('/auth/signup', {
				method: 'POST',
				body: JSON.stringify({ name, email, password, role, message }),
			})
			const data = await response.json()
			if (!response.ok) throw new Error(data.detail || 'Could not submit your access request.')
			setSubmitted(true)
		} catch (submitError) {
			setError(submitError.message || 'Could not connect to the service.')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<section className="ticket-form-card auth-card">
			<span className="section-label">ACCOUNT REQUEST</span>
			<h2>{submitted ? 'Request submitted' : 'Sign up'}</h2>
			{submitted ? (
				<>
					<p>Your request is pending Admin approval. You can sign in after it is approved.</p>
					<button type="button" className="secondary-button" onClick={onBackToLogin}>Back to sign in</button>
					<p className="auth-signup-prompt"><button type="button" className="auth-link" onClick={onForgotPassword}>Forgot password?</button></p>
				</>
			) : (
				<>
					<p>Request a Staff or Support Team account. Admin accounts are created by an administrator.</p>
					<form className="ticket-form" onSubmit={handleSubmit}>
						<div className="form-group">
							<label htmlFor="signup-name">Full name</label>
							<input id="signup-name" autoComplete="name" required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} />
						</div>
						<div className="form-group">
							<label htmlFor="signup-email">Work email</label>
							<input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
						</div>
						<div className="form-group">
							<label htmlFor="signup-role">Account type</label>
							<select id="signup-role" value={role} onChange={(event) => setRole(event.target.value)}>
								<option value="employee">Staff</option>
								<option value="support">Support Team</option>
							</select>
						</div>
						<div className="form-group">
							<label htmlFor="signup-password">Password</label>
							<input id="signup-password" type="password" autoComplete="new-password" minLength="6" maxLength="200" required value={password} onChange={(event) => setPassword(event.target.value)} />
						</div>
						<div className="form-group">
							<label htmlFor="signup-message">Reason for access <span className="optional-label">(optional)</span></label>
							<textarea id="signup-message" maxLength="1000" value={message} onChange={(event) => setMessage(event.target.value)} />
						</div>
						{error && <div className="error-box"><strong>Unable to sign up</strong><span>{error}</span></div>}
						<button type="submit" className="submit-button" disabled={submitting}>
							{submitting ? 'Submitting request...' : 'Request access'}
						</button>
						<button type="button" className="secondary-button" onClick={onBackToLogin}>Back to sign in</button>
						<p className="auth-signup-prompt"><button type="button" className="auth-link" onClick={onForgotPassword}>Forgot password?</button></p>
					</form>
				</>
			)}
		</section>
	)
}

export default SignupForm
