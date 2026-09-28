import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

// Allowed next statuses per the sprint brief's transition table.
const STATUS_TRANSITIONS = {
  Open: ['In Progress'],
  'In Progress': ['Blocked', 'Resolved'],
  Blocked: ['In Progress', 'Resolved'],
  Resolved: ['In Progress'],
}

function TicketDetail({ ticketId, onBack, user }) {
  const [ticket, setTicket] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [notes, setNotes] = useState([])
  const [history, setHistory] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newNote, setNewNote] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('')
  const [shareWithRequester, setShareWithRequester] = useState(true)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState('')

  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [showTicketEditor, setShowTicketEditor] = useState(false)
  const [priorityDraft, setPriorityDraft] = useState('')
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [ticketDetailsSubmitting, setTicketDetailsSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const requests = [apiFetch(`/requests/${ticketId}`)]
      if (user.role !== 'employee') {
        requests.push(apiFetch('/team-members'))
        requests.push(apiFetch(`/requests/${ticketId}/history`))
      }
      requests.push(apiFetch(`/requests/${ticketId}/notes`))
      const responses = await Promise.all(requests)
      const ticketRes = responses[0]
      const membersRes = user.role === 'employee' ? null : responses[1]
      const historyRes = user.role === 'employee' ? null : responses[2]
      const notesRes = responses[responses.length - 1]

      const ticketData = await ticketRes.json()
      const membersData = membersRes ? await membersRes.json() : []
      const historyData = historyRes ? await historyRes.json() : []
      const notesData = await notesRes.json()

      if (!ticketRes.ok) throw new Error(ticketData.detail || 'Failed to load ticket')
      if (!notesRes.ok) throw new Error(notesData.detail || 'Failed to load progress updates')

      setTicket(ticketData)
      setTeamMembers(Array.isArray(membersData) ? membersData : membersData.results || [])
      setHistory(Array.isArray(historyData) ? historyData : historyData.results || [])
      setNotes(Array.isArray(notesData) ? notesData : notesData.results || [])
    } catch (fetchError) {
      console.error('Request failed:', fetchError)
      setError(fetchError.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (event) => {
    const value = event.target.value
    const assignedTo = value === '' ? null : parseInt(value, 10)

    setAssignSubmitting(true)
    setActionError('')

    try {
      const response = await apiFetch(`/requests/${ticketId}/assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assignedTo }),
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
      const response = await apiFetch(`/requests/${ticketId}/status`, {
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

  const handleSaveTicketDetails = async (event) => {
    event.preventDefault()
    setTicketDetailsSubmitting(true)
    setActionError('')
    try {
      const response = await apiFetch(`/requests/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: priorityDraft,
          due_date: dueDateDraft || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to update ticket details')
      setTicket(data)
      setShowTicketEditor(false)
      loadAll()
    } catch (updateError) {
      setActionError(updateError.message || 'Could not update ticket details.')
    } finally {
      setTicketDetailsSubmitting(false)
    }
  }

  const handleAddNote = async (event) => {
    event.preventDefault()

    if (!newNote.trim()) {
      setNoteError('Note cannot be empty.')
      return
    }
    if (!noteAuthor.trim()) {
      setNoteError('Please enter your name.')
      return
    }

    setNoteSubmitting(true)
    setNoteError('')

    try {
      const response = await apiFetch(`/requests/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote, created_by: noteAuthor, is_public: shareWithRequester }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to add note')
      setNewNote('')
      setNotes((prev) => [...prev, data])
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
  const assignedMember = teamMembers.find((m) => m.id === ticket.assigned_to)

  return (
    <div className="ticket-detail-container">

      <button type="button" className="close-button" onClick={onBack}>← Back to list</button>

      <h2>{ticket.title}</h2>
      <p>{ticket.description}</p>

      <div className="ticket-meta-grid">
        <div><strong>Ticket ID:</strong> #{ticket.id}</div>
        <div><strong>Requester:</strong> {ticket.requester_name} ({ticket.requester_email})</div>
        <div><strong>Category:</strong> {ticket.category}</div>
        <div><strong>Priority:</strong> {ticket.priority}</div>
        <div><strong>Status:</strong> {ticket.status}</div>
        <div><strong>Assigned to:</strong> {assignedMember?.name || ticket.assigned_to_name || (ticket.assigned_to ? 'Assigned team member' : 'Unassigned')}</div>
        <div><strong>Due date:</strong> {ticket.due_date || 'None set'}</div>
        <div><strong>Created:</strong> {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}</div>
        <div><strong>Updated:</strong> {ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : '-'}</div>
      </div>

      {actionError && (
        <div className="error-box">
          <strong>Action failed</strong>
          <span>{actionError}</span>
        </div>
      )}

      {user.role !== 'employee' && <div className="form-row">
        <div className="form-group">
          <label htmlFor="assign">Assign to</label>
          <select
            id="assign"
            value={ticket.assigned_to ?? ''}
            onChange={handleAssign}
            disabled={assignSubmitting}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
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
      </div>}

      {user.role !== 'employee' && <div className="ticket-details-editor">
        {!showTicketEditor ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setPriorityDraft(ticket.priority)
              setDueDateDraft(ticket.due_date || '')
              setShowTicketEditor(true)
            }}
          >
            Edit priority and due date
          </button>
        ) : (
          <form className="ticket-form" onSubmit={handleSaveTicketDetails}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ticket-priority">Priority</label>
                <select id="ticket-priority" value={priorityDraft} onChange={(event) => setPriorityDraft(event.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ticket-due-date">Due date</label>
                <input id="ticket-due-date" type="date" value={dueDateDraft} onChange={(event) => setDueDateDraft(event.target.value)} />
              </div>
            </div>
            <button type="submit" className="submit-button" disabled={ticketDetailsSubmitting}>
              {ticketDetailsSubmitting ? 'Saving...' : 'Save ticket details'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setShowTicketEditor(false)} disabled={ticketDetailsSubmitting}>
              Cancel
            </button>
          </form>
        )}
      </div>}

      <div className="form-divider"></div>

      <h3>{user.role === 'employee' ? 'Progress Updates' : 'Progress Notes'}</h3>

      {user.role !== 'employee' && <>
      <form onSubmit={handleAddNote} className="ticket-form">
        <div className="form-group">
          <label htmlFor="noteAuthor">Your name</label>
          <input
            id="noteAuthor"
            type="text"
            placeholder="Your name"
            value={noteAuthor}
            onChange={(e) => setNoteAuthor(e.target.value)}
          />
        </div>
        <div className="form-group">
          <textarea
            placeholder="Add a progress note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
        </div>
        <label className="note-share-toggle">
          <input
            type="checkbox"
            checked={shareWithRequester}
            onChange={(event) => setShareWithRequester(event.target.checked)}
          />
          <span>Share this progress update with the ticket requester</span>
        </label>
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
      </>}

      <ul className="notes-list">
        {notes.length === 0 && <li>{user.role === 'employee' ? 'No progress updates yet.' : 'No notes yet.'}</li>}
        {notes.map((note) => (
          <li key={note.id}>
            <span>{note.note} — <em>{note.created_by}</em></span>
            <span className="note-timestamp">
              {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
            </span>
          </li>
        ))}
      </ul>

      {user.role !== 'employee' && <>
      <div className="form-divider"></div>

      <h3>Activity History</h3>

      <ul className="history-list">
        {history.length === 0 && <li>No activity recorded yet.</li>}
        {history.map((event) => (
          <li key={event.id}>
            <span>{event.description}</span>
            <span className="note-timestamp">
              {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
            </span>
          </li>
        ))}
      </ul>
      </>}

    </div>
  )
}

export default TicketDetail