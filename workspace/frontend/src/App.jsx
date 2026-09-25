import { useState } from 'react'
import CreateTicketForm from './components/CreateTicketForm'
import TicketSuccess from './components/TicketSuccess'
import TicketList from './components/TicketList'
import TicketDetail from './components/TicketDetail'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [showForm, setShowForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [createdTicket, setCreatedTicket] = useState(null)

  const handleTicketSuccess = (ticket) => {
    console.log('Ticket created successfully:', ticket)
    setCreatedTicket(ticket)
  }

  const handleCreateAnother = () => {
    setCreatedTicket(null)
    setShowForm(false)
  }

  const goHome = () => {
    setShowForm(false)
    setShowList(false)
    setShowDashboard(false)
    setSelectedTicketId(null)
  }

  if (createdTicket) {
    return (
      <div className="app-shell">
        <TicketSuccess
          ticket={createdTicket}
          onCreateAnother={handleCreateAnother}
        />
      </div>
    )
  }

  const showingWelcome = !showForm && !showList && !showDashboard && !selectedTicketId

  return (
    <div className="app-shell">

      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <main className="app-container">

        <header className="hero-section">

          <div className="brand-badge">
            <span className="status-dot"></span>
            Internal Support System
          </div>

          <h1>
            Cloudnaut <span>Support Desk</span>
          </h1>

          <p className="hero-subtitle">
            Create and manage technical support requests
            through one centralized platform.
          </p>

        </header>

        {showingWelcome && (
          <section className="welcome-card">

            <div className="welcome-icon">
              🎫
            </div>

            <span className="section-label">
              SUPPORT PORTAL
            </span>

            <h2>How can we help you?</h2>

            <p>
              Submit a technical support request and provide
              the details our team needs to investigate your issue.
            </p>

            <button
              className="primary-button"
              onClick={() => setShowForm(true)}
            >
              <span>Create Support Ticket</span>
              <span className="button-arrow">→</span>
            </button>

            <button
              className="primary-button"
              onClick={() => setShowList(true)}
              style={{ marginTop: '12px' }}
            >
              <span>View All Tickets</span>
              <span className="button-arrow">→</span>
            </button>

            <button
              className="primary-button"
              onClick={() => setShowDashboard(true)}
              style={{ marginTop: '12px' }}
            >
              <span>View Dashboard</span>
              <span className="button-arrow">→</span>
            </button>

            <div className="feature-grid">

              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <div>
                  <h3>Quick Submission</h3>
                  <p>
                    Create a request in just a few steps.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">🛠️</div>
                <div>
                  <h3>Technical Support</h3>
                  <p>
                    Report application, access or infrastructure issues.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">📋</div>
                <div>
                  <h3>Track Requests</h3>
                  <p>
                    Every submitted request gets a unique ticket ID.
                  </p>
                </div>
              </div>

            </div>

          </section>
        )}

        {showForm && (
          <section className="ticket-form-card">

            <div className="form-header">

              <div>
                <span className="section-label">
                  NEW SUPPORT REQUEST
                </span>

                <h2>Create Ticket</h2>

                <p>
                  Enter the information below to submit your
                  support request.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>

            </div>

            <div className="form-divider"></div>

            <CreateTicketForm
              onSuccess={handleTicketSuccess}
            />

          </section>
        )}

        {showList && !selectedTicketId && (
          <section className="ticket-form-card">

            <div className="form-header">

              <div>
                <span className="section-label">
                  ALL REQUESTS
                </span>

                <h2>Support Requests</h2>

                <p>
                  View, filter and sort all submitted tickets. Click a row for details.
                </p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={goHome}
              >
                ×
              </button>

            </div>

            <div className="form-divider"></div>

            <TicketList
              onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
            />

          </section>
        )}

        {selectedTicketId && (
          <section className="ticket-form-card">

            <div className="form-header">
              <div>
                <span className="section-label">TICKET DETAIL</span>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={goHome}
              >
                ×
              </button>
            </div>

            <div className="form-divider"></div>

            <TicketDetail
              ticketId={selectedTicketId}
              onBack={() => setSelectedTicketId(null)}
            />

          </section>
        )}

        {showDashboard && (
          <section className="ticket-form-card">

            <div className="form-header">

              <div>
                <span className="section-label">OVERVIEW</span>
                <h2>Dashboard</h2>
                <p>Summary of all support requests.</p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={goHome}
              >
                ×
              </button>

            </div>

            <div className="form-divider"></div>

            <Dashboard />

          </section>
        )}

      </main>

      <footer className="app-footer">
        <strong>Cloudnaut Support Desk</strong>
        <span>Technical Support Management System</span>
      </footer>

    </div>
  )
}

export default App