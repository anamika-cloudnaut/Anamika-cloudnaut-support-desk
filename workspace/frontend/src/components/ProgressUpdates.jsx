import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

function ProgressUpdates({ onOpenTicket }) {
  const [updates, setUpdates] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiFetch('/progress-updates')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not load progress updates.')
        if (active) setUpdates(data)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not connect to the service.')
      })
    return () => { active = false }
  }, [])

  return (
    <section className="progress-updates-section" aria-labelledby="progress-updates-title">
      <div className="progress-updates-header">
        <div>
          <span className="section-label">YOUR REQUESTS</span>
          <h3 id="progress-updates-title">Progress Updates</h3>
        </div>
      </div>
      {error ? (
        <p className="progress-updates-empty">{error}</p>
      ) : updates.length === 0 ? (
        <p className="progress-updates-empty">Updates from the support team will appear here.</p>
      ) : (
        <ul className="progress-updates-list">
          {updates.map((update) => (
            <li key={update.id} className="progress-update-item">
              <div className="progress-update-meta">
                <span>#{update.request_id} · {update.ticket_title}</span>
                <time dateTime={update.created_at}>{new Date(update.created_at).toLocaleString()}</time>
              </div>
              <p>{update.note}</p>
              <div className="progress-update-footer">
                <span>From {update.created_by || 'Support Team'}</span>
                <button type="button" className="text-action-button" onClick={() => onOpenTicket(update.request_id)}>
                  View ticket
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ProgressUpdates