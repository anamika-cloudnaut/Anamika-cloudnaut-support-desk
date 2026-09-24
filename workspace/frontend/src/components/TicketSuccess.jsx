
function TicketSuccess({ ticket }) {
  return (
    <div className="app">
      <div className="success">

        <h1>Ticket Created Successfully! 🎉</h1>

        <p>
          Your support ticket has been created successfully.
        </p>

        {ticket && (
          <div className="ticket-details">
            <p>
              <strong>Ticket ID:</strong> {ticket.id}
            </p>

            <p>
              <strong>Title:</strong> {ticket.title}
            </p>

            <p>
              <strong>Status:</strong> {ticket.status}
            </p>

            <p>
              <strong>Priority:</strong> {ticket.priority}
            </p>
          </div>
        )}

        <button onClick={() => window.location.reload()}>
          Create Another Ticket
        </button>

      </div>
    </div>
  )
}

export default TicketSuccess

