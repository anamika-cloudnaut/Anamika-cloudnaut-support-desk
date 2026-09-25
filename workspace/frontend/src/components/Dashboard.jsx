import { useState, useEffect } from 'react'

function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:4000/dashboard/summary')
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

  // CHECK: this assumes summary.by_status is an object like { Open: 4, "In Progress": 2, ... }
  // and summary.total is a number. Adjust keys below once you confirm the real shape in Swagger.
  const statusEntries = Object.entries(summary.by_status || {})

  return (
    <div className="dashboard-container">
      <div className="feature-grid">
        <div className="feature-item">
          <div className="feature-icon">📊</div>
          <div>
            <h3>Total Requests</h3>
            <p>{summary.total ?? '-'}</p>
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
    </div>
  )
}

export default Dashboard