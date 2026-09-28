import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchSummary() {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch('/dashboard/summary')
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to load dashboard')
      setSummary(data)
    } catch (fetchError) {
      console.error('Request failed:', fetchError)
      setError(fetchError.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  if (loading) return <p>Loading dashboard...</p>

  if (error) {
    return (
      <div className="error-box">
        <strong>Unable to load dashboard</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!summary) return null

  const statusEntries = Object.entries(summary.by_status || {})
  const assigneeEntries = Object.entries(summary.by_assignee || {})

  return (
    <div className="dashboard-container">
      <div className="feature-grid">
        <div className="feature-item">
          <div className="feature-icon">📊</div>
          <div>
            <h3>Total Requests</h3>
            <p>{summary.total}</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">👤</div>
          <div>
            <h3>Assigned</h3>
            <p>{summary.assigned}</p>
          </div>
        </div>

        <div className="feature-item">
          <div className="feature-icon">🕓</div>
          <div>
            <h3>Unassigned</h3>
            <p>{summary.unassigned}</p>
          </div>
        </div>

        {statusEntries.map(([status, count]) => (
          <div className="feature-item" key={status}>
            <div className="feature-icon">🎫</div>
            <div>
              <h3>{status}</h3>
              <p>{count}</p>
            </div>
          </div>
        ))}
      </div>

      {assigneeEntries.length > 0 && (
        <>
          <div className="form-divider"></div>
          <h3>By Assignee</h3>
          <ul className="history-list">
            {assigneeEntries.map(([name, count]) => (
              <li key={name}>
                <span>{name}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default Dashboard