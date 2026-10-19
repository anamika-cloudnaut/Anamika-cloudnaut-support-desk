import TicketAttachments from './TicketAttachments'

function TicketSuccess({
  ticket,
  user,
  pendingFiles,
  attachmentErrors,
  onCreateAnother,
  onGoHome,
}) {
  const formatDate = (value) => {
    if (!value) return 'Not provided'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleString()
  }

  return (
    <div className="success-page">
      <div className="success-card">

        <div className="success-icon">
          ✓
        </div>

        <span className="success-label">
          TICKET CREATED
        </span>

        <h1>Support Request Submitted</h1>

        <p className="success-description">
          Your support request has been successfully created and
          recorded in the Cloudnaut Support Desk.
        </p>

        <div className="ticket-id-box">
          <span>Ticket ID</span>
          <strong>#{ticket?.id}</strong>
        </div>

        {ticket?.email_sent === true && (
          <p className="email-confirmation email-confirmation-ok" role="status">
            ✉️ A confirmation email was sent to {ticket?.requester_email}.
          </p>
        )}
        {ticket?.email_sent === false && (
          <p className="email-confirmation email-confirmation-soft" role="status">
            Your ticket was created. (A confirmation email could not be sent right now.)
          </p>
        )}

        <div className="success-details">

          <div className="detail-item full-width">
            <span className="detail-label">Title</span>
            <strong>{ticket?.title || 'Not available'}</strong>
          </div>

          <div className="detail-item full-width">
            <span className="detail-label">Description</span>
            <p>{ticket?.description || 'Not available'}</p>
          </div>

          <div className="detail-item">
            <span className="detail-label">Requester Name</span>
            <strong>
              {ticket?.requester_name || 'Not available'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Requester Email</span>
            <strong>
              {ticket?.requester_email || 'Not available'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Category</span>
            <strong>{ticket?.category || 'Not available'}</strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Priority</span>
            <strong className={`priority-${ticket?.priority?.toLowerCase()}`}>
              {ticket?.priority || 'Not available'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Status</span>
            <strong className="status-badge">
              {ticket?.status || 'Open'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Assigned To</span>
            <strong>
              {ticket?.assigned_to ?? 'Not assigned'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Due Date</span>
            <strong>
              {ticket?.due_date || 'Not provided'}
            </strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Created At</span>
            <strong>{formatDate(ticket?.created_at)}</strong>
          </div>

          <div className="detail-item">
            <span className="detail-label">Updated At</span>
            <strong>{formatDate(ticket?.updated_at)}</strong>
          </div>

        </div>

        {attachmentErrors?.length > 0 && (
          <div className="error-box attachment-upload-warning" role="alert">
            <strong>Ticket created, but some attachments were not uploaded</strong>
            <span>Your ticket is safe. Retry the remaining files below.</span>
            {attachmentErrors.map((message, index) => (
              <span key={`${message}-${index}`}>{message}</span>
            ))}
          </div>
        )}

        {user && (
          <TicketAttachments
            key={ticket.id}
            requestId={ticket.id}
            initialFiles={pendingFiles || []}
          />
        )}

        <div className="success-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onCreateAnother}
          >
            Create Another Ticket
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onGoHome}
          >
            Home
          </button>
        </div>

      </div>
    </div>
  )
}

export default TicketSuccess