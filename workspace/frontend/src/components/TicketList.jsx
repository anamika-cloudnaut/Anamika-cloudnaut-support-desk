import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../api'

const STATUS_OPTIONS = ['Open', 'In Progress', 'Blocked', 'Resolved']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']
const CATEGORY_OPTIONS = ['Application', 'Access', 'Infrastructure', 'Data', 'Other']

function TicketList({ onSelectTicket }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch('/requests')
      const data = await response.json()

      console.log('Tickets fetched:', data)

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load tickets')
      }

      setTickets(Array.isArray(data) ? data : data.results || [])
    } catch (fetchError) {
      console.error('Request failed:', fetchError)
      setError(fetchError.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  const visibleTickets = useMemo(() => {
    let result = [...tickets]

    if (statusFilter) result = result.filter((t) => t.status === statusFilter)
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter)
    if (categoryFilter) result = result.filter((t) => t.category === categoryFilter)

    result.sort((a, b) => {
      const aVal = a[sortBy] ?? ''
      const bVal = b[sortBy] ?? ''
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [tickets, statusFilter, priorityFilter, categoryFilter, sortBy, sortDir])

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  const clearFilters = () => {
    setStatusFilter('')
    setPriorityFilter('')
    setCategoryFilter('')
  }

  const sortArrow = (field) => {
    if (field !== sortBy) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="ticket-list-container">

      <div className="filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        {(statusFilter || priorityFilter || categoryFilter) && (
          <button type="button" className="close-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="error-box">
          <strong>Unable to load tickets</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && <p>Loading tickets...</p>}

      {!loading && !error && visibleTickets.length === 0 && (
        <p>No tickets match the current filters.</p>
      )}

      {!loading && !error && visibleTickets.length > 0 && (
        <div className="ticket-table-wrap">
          <table className="ticket-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id')}>ID{sortArrow('id')}</th>
                <th onClick={() => toggleSort('title')}>Title{sortArrow('title')}</th>
                <th onClick={() => toggleSort('category')}>Category{sortArrow('category')}</th>
                <th onClick={() => toggleSort('priority')}>Priority{sortArrow('priority')}</th>
                <th onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
                <th>Assigned To</th>
                <th onClick={() => toggleSort('created_at')}>Created{sortArrow('created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id} onClick={() => onSelectTicket && onSelectTicket(ticket)}>
                  <td className="ticket-id-cell">#{ticket.id}</td>
                  <td className="ticket-title-cell">{ticket.title}</td>
                  <td>{ticket.category}</td>
                  <td>
                    <span className={`badge badge-priority-${ticket.priority?.toLowerCase()}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-status-${ticket.status?.toLowerCase().replace(' ', '-')}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td>{ticket.assigned_to_name || (ticket.assigned_to ? 'Assigned' : 'Unassigned')}</td>
                  <td>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}

export default TicketList