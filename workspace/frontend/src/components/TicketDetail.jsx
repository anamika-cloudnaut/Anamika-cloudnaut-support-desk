import { useState, useEffect } from 'react'

// Allowed next statuses per the sprint brief's transition table.
// CHECK: confirm these status strings exactly match what your API returns.
const STATUS_TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['Blocked', 'Resolved'],
  Blocked: ['In Progress', 'Resolved'],
  Resolved: ['In Progress'],
}

function TicketDetail({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [notes, setNotes] = useState([])
  const [history, setHistory] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newNote, setNewNote] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState('')

  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [ticketRes, membersRes, historyRes] = await Promise.all([
        fetch(`http://localhost:4000/requests/${ticketId}`),
        fetch('http://localhost:4000/team-members'),
        fetch(`http://localhost:4000/requests/${ticketId}/history`),
      ])

      const ticketData = await ticketRes.json()
      const membersData = await membersRes.json()
      const historyData = await historyRes.json()

      if (!ticketRes.ok) throw new Error(ticketData.detail || 'Failed to load ticket')

      setTicket(ticketData)
      setTeamMembers(Array.isArray(membersData) ? membersData : membersData.results || [])
      setHistory(Array.isArray(historyData) ? historyData : historyData.results || [])
      // CHECK: if your ticket response already includes its notes array,
      // you can pull setNotes(ticketData.notes || []) here instead of a separate call.
      setNotes(ticketData.notes || [])
    } catch (fetchError) {
      console.error('Request failed:', fetchError)
      setError(fetchError.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (event) => {
    const assignedTo = event.target.value
    setAssignSubmitting(true)
    setActionError('')

    try {
      const response = await fetch(`http://localhost:4000/requests/${ticketId}/assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to assign ticket')
      setTicket(data)
      loadAll()
    } catch (assignError) {
      console.error('Assignment failed:', assignError)
      setActionError(assignError.message || 'Could not update assignment.')
    } finally {
      setAssignSubmitting(false)
    }
  }

  const handleStatusChange = async (event) => {
    const status = event.target.value
    if (!status) return

    setStatusSubmitting(true)
    setActionError('')

    try {
      const response = await fetch(`http://localhost:4000/requests/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to update status')
      setTicket(data)
      loadAll()
    } catch (statusError) {
      console.error('Status update failed:', statusError)
      setActionError(statusError.message || 'Could not update status.')
    } finally {
      setStatusSubmitting(false)
    }
  }

  const handleAddNote = async (event) => {
    event.preventDefault()
    if (!newNote.trim()) {
      setNoteError('Note cannot be empty.')
      return
    }

    setNoteSubmitting(true)
    setNoteError('')

    try {
      const response = await fetch(`http://localhost:4000/requests/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to add note')
      setNewNote('')
      loadAll()
    } catch (noteErr) {
      console.error('Add note failed:', noteErr)
      setNoteError(noteErr.message || 'Could not add note.')
    } finally {
      setNoteSubmitting(false)
    }
  }

  if (loading) return <p>Loading ticket...</p>

  if (error) {
    return (
      <div className="error-box">
        <strong>Unable to load ticket</strong>
        <span>{error}</span>
      </div>
    )
  }

  if (!ticket) return null

  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || []

  return (
    <div className="ticket-detail-container">

      <button type="button" className="close-button" onClick={onBack}>← Back to list</button>

      <h2>{ticket.title}</h2>
      <p>{ticket.description}</p>

      <div className="ticket-meta-grid">
        <div><strong>Requester:</strong> {ticket.requester_name} ({ticket.requester_email})</div>
        <div><strong>Category:</strong> {ticket.category}</div>
        <div><strong>Priority:</strong> {ticket.priority}</div>
        <div><strong>Status:</strong> {ticket.status}</div>
        <div><strong>Due date:</strong> {ticket.due_date || 'None set'}</div>
        <div><strong>Created:</strong> {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}</div>
      </div>

      {actionError && (
        <div className="error-box">
          <strong>Action failed</strong>
          <span>{actionError}</span>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="assign">Assign to</label>
          <select
            id="assign"
            value={ticket.assigned_to || ''}
            onChange={handleAssign}
            disabled={assignSubmitting}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.name || member.id}>
                {member.name || member.id}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="status">Change status</label>
          <select
            id="status"
            value=""
            onChange={handleStatusChange}
            disabled={statusSubmitting || nextStatuses.length === 0}
          >
            <option value="">
              {nextStatuses.length === 0 ? 'No transitions available' : `Current: ${ticket.status}`}
            </option>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>Move to {status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-divider"></div>

      <h3>Progress Notes</h3>

      <form onSubmit={handleAddNote} className="ticket-form">
        <div className="form-group">
          <textarea
            placeholder="Add a progress note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
        </div>
        {noteError && (
          <div className="error-box">
            <strong>Unable to add note</strong>
            <span>{noteError}</span>
          </div>
        )}
        <button type="submit" className="submit-button" disabled={noteSubmitting}>
          {noteSubmitting ? 'Adding...' : 'Add Note'}
        </button>
      </form>

      <ul className="notes-list">
        {notes.length === 0 && <li>No notes yet.</li>}
        {notes.map((note) => (
          <li key={note.id}>
            <span>{note.content}</span>
            <span className="note-timestamp">
              {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
            </span>
          </li>
        ))}
      </ul>

      <div className="form-divider"></div>

      <h3>Activity History</h3>

      <ul className="history-list">
        {history.length === 0 && <li>No activity recorded yet.</li>}
        {history.map((event, index) => (
          <li key={event.id || index}>
            <span>{event.description || event.change || JSON.stringify(event)}</span>
            <span className="note-timestamp">
              {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
            </span>
          </li>
        ))}
      </ul>

    </div>
  )
}

export default TicketDetail