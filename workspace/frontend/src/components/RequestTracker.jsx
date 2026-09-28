import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const steps = ['Open', 'In Progress', 'Resolved']

function getProgressIndex(status) {
  if (status === 'In Progress' || status === 'Blocked') return 1
  if (status === 'Resolved') return 2
  return 0
}

function RequestTracker({ onOpenTicket, compact = false, onViewAll }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiFetch('/requests')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not load your requests.')
        if (active) setTickets(Array.isArray(data) ? data : data.results || [])
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not connect to the service.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (compact) {
    return (
      <button
        type="button"
        className="request-tracker-launcher"
        onClick={onViewAll}
        aria-label="Open request tracking"
      >
        <span className="feature-icon" aria-hidden="true">📋</span>
        <span className="request-tracker-launcher-copy">
          <strong>Track Requests</strong>
          <span>{loading ? 'Loading requests...' : error ? 'Unable to load requests' : 'Check status and progress'}</span>
        </span>
        <span className="request-tracker-launcher-count">
          {loading || error ? '→' : tickets.length}
        </span>
      </button>
    )
  }

  return (
    <section className="request-tracker-card" aria-labelledby="request-tracker-title">
      <header className="request-tracker-header">
        <div>
          <span className="section-label">LIVE TRACKING</span>
          <h3 id="request-tracker-title">Track Requests</h3>
          <p>Follow each request from submission through resolution.</p>
        </div>
        <span className="request-tracker-count">{tickets.length} {tickets.length === 1 ? 'request' : 'requests'}</span>
      </header>

      {loading ? (
        <p className="request-tracker-state">Loading your requests...</p>
      ) : error ? (
        <p className="request-tracker-state request-tracker-error">{error}</p>
      ) : tickets.length === 0 ? (
        <p className="request-tracker-state">Your submitted requests will appear here.</p>
      ) : (
        <ul className="request-tracker-list">
          {tickets.map((ticket) => {
            const progressIndex = getProgressIndex(ticket.status)
            const statusClass = ticket.status.toLowerCase().replace(' ', '-')
            return (
              <li key={ticket.id} className="request-tracker-item">
                <div className="request-tracker-item-header">
                  <div className="request-tracker-ticket-title">
                    <span>#{ticket.id}</span>
                    <h4>{ticket.title}</h4>
                  </div>
                  <span className={`request-tracker-status badge-status-${statusClass}`}>{ticket.status}</span>
                </div>

                <ol className="request-status-steps" aria-label={`Request status: ${ticket.status}`}>
                  {steps.map((step, index) => (
                    <li
                      key={step}
                      className={index < progressIndex ? 'is-complete' : index === progressIndex ? 'is-current' : ''}
                    >
                      <span className="request-status-dot" aria-hidden="true"></span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {ticket.status === 'Blocked' && (
                  <p className="request-blocked-message">This request is blocked. The support team will update its status when work resumes.</p>
                )}

                <footer className="request-tracker-item-footer">
                  <span>Updated {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'recently'}</span>
                  <button type="button" className="text-action-button" onClick={() => onOpenTicket(ticket.id)}>
                    View details
                  </button>
                </footer>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default RequestTracker