import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const roleNames = { employee: 'Staff', support: 'Support Team' }

function AccessRequestReview() {
	const [requests, setRequests] = useState([])
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(true)
	const [reviewingId, setReviewingId] = useState(null)

	useEffect(() => {
		let active = true
		apiFetch('/access-requests?status=pending')
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.detail || 'Could not load access requests.')
				if (active) setRequests(data)
			})
			.catch((loadError) => {
				if (active) setError(loadError.message || 'Could not connect to the service.')
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => { active = false }
	}, [])

	const reviewRequest = async (requestId, status) => {
		setReviewingId(requestId)
		setError('')
		try {
			const response = await apiFetch(`/access-requests/${requestId}`, {
				method: 'PATCH',
				body: JSON.stringify({ status }),
			})
			const data = await response.json()
			if (!response.ok) throw new Error(data.detail || 'Could not review this request.')
			setRequests((current) => current.filter((request) => request.id !== requestId))
		} catch (reviewError) {
			setError(reviewError.message || 'Could not connect to the service.')
		} finally {
			setReviewingId(null)
		}
	}

	if (loading) return <p className="access-request-state">Loading access requests...</p>

	return (
		<div className="access-request-list">
			{error && <div className="error-box"><strong>Request action failed</strong><span>{error}</span></div>}
			{requests.length === 0 ? (
				<p className="access-request-state">There are no pending access requests.</p>
			) : requests.map((request) => (
				<article key={request.id} className="access-request-item">
					<div className="access-request-details">
						<div>
							<h3>{request.name}</h3>
							<p>{request.email}</p>
						</div>
						<span className="access-request-role">{roleNames[request.role] || request.role}</span>
					</div>
					{request.message && <p className="access-request-message">{request.message}</p>}
					<div className="access-request-actions">
						<button type="button" className="submit-button" disabled={reviewingId !== null} onClick={() => reviewRequest(request.id, 'approved')}>
							{reviewingId === request.id ? 'Saving...' : 'Approve'}
						</button>
						<button type="button" className="secondary-button" disabled={reviewingId !== null} onClick={() => reviewRequest(request.id, 'rejected')}>
							Reject
						</button>
					</div>
				</article>
			))}
		</div>
	)
}

export default AccessRequestReview
