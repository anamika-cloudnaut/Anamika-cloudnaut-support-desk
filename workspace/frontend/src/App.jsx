import { useState } from 'react'
import LoginForm from './components/LoginForm'
import ForgotPasswordForm from './components/ForgotPasswordForm'
import PasswordResetForm from './components/PasswordResetForm'
import RoleSelection from './components/RoleSelection'
import SignupForm from './components/SignupForm'
import AccessRequestReview from './components/AccessRequestReview'
import TeamManagement from './components/TeamManagement'
import CreateTicketForm from './components/CreateTicketForm'
import TicketSuccess from './components/TicketSuccess'
import TicketList from './components/TicketList'
import TicketDetail from './components/TicketDetail'
import Dashboard from './components/Dashboard'
import ProgressUpdates from './components/ProgressUpdates'
import RequestTracker from './components/RequestTracker'
import './App.css'

function App() {
  const resetToken = new URLSearchParams(window.location.search).get('reset_token')
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('supportDeskToken')
    const user = localStorage.getItem('supportDeskUser')
    return token && user ? { token, user: JSON.parse(user) } : null
  })
  const [showLogin, setShowLogin] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [showAccessRequests, setShowAccessRequests] = useState(false)
  const [showRequestTracker, setShowRequestTracker] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [createdTicket, setCreatedTicket] = useState(null)
  const [failedTicketAttachments, setFailedTicketAttachments] = useState([])
  const [attachmentUploadErrors, setAttachmentUploadErrors] = useState([])

  const handleTicketSuccess = (ticket, failedFiles = [], uploadErrors = []) => {
    setCreatedTicket(ticket)
    setFailedTicketAttachments(failedFiles)
    setAttachmentUploadErrors(uploadErrors)
  }

  const handleCreateAnother = () => {
    setCreatedTicket(null)
    setFailedTicketAttachments([])
    setAttachmentUploadErrors([])
    setShowForm(false)
  }

  const goHome = () => {
    setCreatedTicket(null)
    setFailedTicketAttachments([])
    setAttachmentUploadErrors([])
    setShowForm(false)
    setShowList(false)
    setShowDashboard(false)
    setShowTeam(false)
    setShowAccessRequests(false)
    setShowRequestTracker(false)
    setSelectedTicketId(null)
  }

  const handleLogin = (loginData) => {
    localStorage.setItem('supportDeskToken', loginData.access_token)
    localStorage.setItem('supportDeskUser', JSON.stringify(loginData.user))
    setSession({ token: loginData.access_token, user: loginData.user })
    setShowLogin(false)
    setShowSignup(false)
    setShowForgotPassword(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('supportDeskToken')
    localStorage.removeItem('supportDeskUser')
    setSession(null)
    setShowLogin(false)
    setShowSignup(false)
    setShowForgotPassword(false)
    setSelectedRole(null)
    goHome()
  }

  if (createdTicket) {
    return (
      <div className="app-shell">
        <TicketSuccess
          ticket={createdTicket}
          user={session?.user}
          pendingFiles={failedTicketAttachments}
          attachmentErrors={attachmentUploadErrors}
          onCreateAnother={handleCreateAnother}
          onGoHome={goHome}
        />
      </div>
    )
  }

  const showingWelcome = !showForm && !showList && !showDashboard && !showTeam && !showAccessRequests && !showRequestTracker && !selectedTicketId

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

        {resetToken ? (
          <PasswordResetForm
            token={resetToken}
            onComplete={() => {
              window.history.replaceState({}, '', window.location.pathname)
              setSelectedRole(null)
              setShowLogin(true)
              setShowSignup(false)
            }}
          />
        ) : !session ? (
          showForgotPassword ? (
            <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
          ) : showSignup ? (
            <SignupForm
              initialRole={selectedRole}
              onBackToLogin={() => setShowSignup(false)}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          ) : showLogin ? (
            selectedRole ? (
              <LoginForm
                role={selectedRole}
                onLogin={handleLogin}
                onBackToRoles={() => setSelectedRole(null)}
                onSignUp={() => setShowSignup(true)}
                onForgotPassword={() => setShowForgotPassword(true)}
              />
            ) : (
              <RoleSelection
                onSelectRole={setSelectedRole}
                onBackHome={() => setShowLogin(false)}
              />
            )
          ) : (
            <section className="welcome-card public-home-card">
              <div className="welcome-icon">🎫</div>
              <span className="section-label">SUPPORT PORTAL</span>
              <h2>Welcome to Cloudnaut Support Desk</h2>
              <p>Sign in with your work account to create support requests and follow their progress.</p>
              <button type="button" className="primary-button" onClick={() => { setSelectedRole(null); setShowSignup(false); setShowLogin(true) }}>
                <span>Sign in</span>
                <span className="button-arrow">→</span>
              </button>
            </section>
          )
        ) : (
          <div className="session-strip">
            <span>{session.user.name} <strong>{session.user.role}</strong></span>
            <button type="button" className="secondary-button" onClick={handleLogout}>Sign out</button>
          </div>
        )}

        {session && showingWelcome && (
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

            <div className="welcome-actions">
              <button
                className="primary-button"
                onClick={() => setShowForm(true)}
              >
                <span>Create Support Ticket</span>
                <span className="button-arrow">→</span>
              </button>

              <button
                className="secondary-button"
                onClick={() => setShowList(true)}
              >
                <span>View All Tickets</span>
                <span className="button-arrow">→</span>
              </button>

              {(session.user.role === 'support' || session.user.role === 'admin') && (
                <button
                  className="secondary-button"
                  onClick={() => setShowDashboard(true)}
                >
                  <span>View Dashboard</span>
                  <span className="button-arrow">→</span>
                </button>
              )}

              {session.user.role === 'admin' && (
                <button
                  className="secondary-button"
                  onClick={() => setShowTeam(true)}
                >
                  <span>Manage Staff Access</span>
                  <span className="button-arrow">→</span>
                </button>
              )}

              {session.user.role === 'admin' && (
                <button
                  className="secondary-button"
                  onClick={() => setShowAccessRequests(true)}
                >
                  <span>Access Requests</span>
                  <span className="button-arrow">→</span>
                </button>
              )}
            </div>

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

              {session.user.role === 'employee' ? (
                <RequestTracker
                  compact
                  onViewAll={() => setShowRequestTracker(true)}
                />
              ) : (
                <div className="feature-item">
                  <div className="feature-icon">📋</div>
                  <div>
                    <h3>Track Requests</h3>
                    <p>Every submitted request gets a unique ticket ID.</p>
                  </div>
                </div>
              )}

            </div>

          </section>
        )}

        {session && showForm && (
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
              user={session.user}
            />

          </section>
        )}

        {session && showList && !selectedTicketId && (
          <section className="ticket-form-card">

            <div className="form-header">

              <div>
                <span className="section-label">
                  ALL REQUESTS
                </span>

                <h2>{session.user.role === 'employee' ? 'My Requests' : 'Support Requests'}</h2>

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

        {session && selectedTicketId && (
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
              user={session.user}
            />

          </section>
        )}

        {session && showDashboard && (session.user.role === 'support' || session.user.role === 'admin') && (
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

            <Dashboard user={session.user} />

          </section>
        )}

        {session && showRequestTracker && session.user.role === 'employee' && !selectedTicketId && (
          <section className="ticket-form-card request-tracker-page">
            <div className="form-header">
              <div>
                <span className="section-label">YOUR REQUESTS</span>
                <h2>Track Requests</h2>
                <p>Follow each request through the support process.</p>
              </div>
              <button type="button" className="close-button" onClick={goHome} aria-label="Back to dashboard">×</button>
            </div>
            <div className="form-divider"></div>
            <RequestTracker onOpenTicket={(ticketId) => setSelectedTicketId(ticketId)} />
          </section>
        )}

        {session && showTeam && session.user.role === 'admin' && (
          <section className="ticket-form-card">
            <div className="form-header">
              <div>
                <span className="section-label">ADMINISTRATION</span>
                <h2>Staff Access</h2>
                <p>Create accounts, assign roles, reset passwords, and disable access.</p>
              </div>
              <button type="button" className="close-button" onClick={goHome}>×</button>
            </div>
            <div className="form-divider"></div>
            <TeamManagement />
          </section>
        )}

        {session && showAccessRequests && session.user.role === 'admin' && (
          <section className="ticket-form-card">
            <div className="form-header">
              <div>
                <span className="section-label">ADMINISTRATION</span>
                <h2>Access Requests</h2>
                <p>Review Staff and Support Team account requests.</p>
              </div>
              <button type="button" className="close-button" onClick={goHome}>×</button>
            </div>
            <div className="form-divider"></div>
            <AccessRequestReview />
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