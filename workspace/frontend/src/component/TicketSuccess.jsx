function TicketSuccess({ ticket }) {
  return (
    <div>
      <h1>Ticket Created Successfully! 🎉</h1>

      <p>Your support ticket has been created.</p>

      {ticket && (
        <div>
          <p>
            <strong>Ticket ID:</strong> {ticket.id}
          </p>

          <p>
            <strong>Title:</strong> {ticket.title}
          </p>

          <p>
            <strong>Status:</strong> {ticket.status}
          </p>
        </div>
      )}

      <button onClick={() => window.location.reload()}>
        Create Another Ticket
      </button>
    </div>
  )
}

export default TicketSuccess;