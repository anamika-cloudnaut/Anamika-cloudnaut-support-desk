
import { useState } from 'react'
import CreateTicketForm from './components/CreateTicketForm'
import TicketSuccess from './components/TicketSuccess'

function App() {
  const [showForm, setShowForm] = useState(false)
  const [createdTicket, setCreatedTicket] = useState(null)

  const handleTicketSuccess = (ticket) => {
    console.log('Ticket created successfully:', ticket)
    setCreatedTicket(ticket)
  }

  if (createdTicket) {
    return <TicketSuccess ticket={createdTicket} />
  }

  return (
    <div className="app">

      <div className="header">
        <h1>Cloudnaut Support Desk</h1>
        <p>Manage and track support tickets.</p>
      </div>

      {!showForm && (
        <div className="card">
          <button onClick={() => setShowForm(true)}>
            Create Ticket
          </button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <CreateTicketForm onSuccess={handleTicketSuccess} />
        </div>
      )}

    </div>
  )
}

export default App
