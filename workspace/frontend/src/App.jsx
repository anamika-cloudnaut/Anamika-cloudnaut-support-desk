
import { useState } from 'react'
import CreateTicketForm from './component/CreateTicketForm'
import TicketSuccess from './component/TicketSuccess'

function App() {
  const [showForm, setShowForm] = useState(false)
  const [createdTicket, setCreatedTicket] = useState(null)

  const handleTicketSuccess = (ticket) => {
    console.log('Ticket created successfully:', ticket)
    setCreatedTicket(ticket)
  }

  // Show success page after ticket is created
  if (createdTicket) {
    return <TicketSuccess ticket={createdTicket} />
  }

  return (
    <div>
      <h1>Cloudnaut Support Desk</h1>

      <p>Manage and track support tickets.</p>

      {!showForm && (
        <button onClick={() => setShowForm(true)}>
          Create Ticket
        </button>
      )}

      {showForm && (
        <CreateTicketForm onSuccess={handleTicketSuccess} />
      )}
    </div>
  )
}

export default App