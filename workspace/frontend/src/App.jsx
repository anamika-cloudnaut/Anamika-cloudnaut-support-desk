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
import RequestTracker from './components/RequestTracker'
import Profile from './components/Profile'
import { signOut as cognitoSignOut } from './cognito'
import './App.css'

// Shared panel header: a back arrow (to the previous screen, or home) and a
// forward arrow that returns to the home/welcome screen (replaces the old ×).
// Defined at module scope so it is not recreated on every App render.
function PanelHeader({ label, title, description, onBack, onHome }) {
  return (
    <div className="form-header">
      <div className="panel-nav">
        <button
          type="button"
          className="nav-arrow nav-back"
          onClick={onBack || onHome}
          aria-label="Go back"
          title="Back"
        >
          ←
        </button>
        <div>
          {label && <span className="section-label">{label}</span>}
          {title && <h2>{title}</h2>}
          {description && <p>{description}</p>}
        </div>
      </div>
      <button
        type="button"
        className="nav-arrow nav-forward"
        onClick={onHome}
        aria-label="Back to home"
        title="Home"
      >
        →
      </button>
    </div>
  )
}

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
  const [showProfile, setShowProfile] = useState(false)
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
    setShowProfile(false)
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
    cognitoSignOut().catch(() => {})
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

  const showingWelcome = !showForm && !showList && !showDashboard && !showTeam && !showAccessRequests && !showRequestTracker && !showProfile && !selectedTicketId

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
            <button
              type="button"
              className="session-identity"
              onClick={() => { goHome(); setShowProfile(true) }}
              title="View your profile"
            >
              <span className="session-avatar" aria-hidden="true">
                {(session.user.name || session.user.email || '?').charAt(0).toUpperCase()}
              </span>
              <span className="session-identity-text">
                <span className="session-name">{session.user.name}</span>
                <span className="session-role">{session.user.role}</span>
              </span>
            </button>
            <div className="session-strip-actions">
              <button type="button" className="secondary-button" onClick={() => { goHome(); setShowProfile(true) }}>My Profile</button>
              <button type="button" className="secondary-button" onClick={handleLogout}>Sign out</button>
            </div>
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

            <div className="welcome-actions welcome-actions-centered">
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

            {/* Employees keep their functional request tracker on the home page. */}
            {session.user.role === 'employee' && (
              <div className="feature-grid">
                <RequestTracker
                  compact
                  onViewAll={() => setShowRequestTracker(true)}
                />
              </div>
            )}

          </section>
        )}

        {session && showForm && (
          <section className="ticket-form-card">

            <PanelHeader
              label="NEW SUPPORT REQUEST"
              title="Create Ticket"
              description="Enter the information below to submit your support request."
              onHome={goHome}
            />

            <div className="form-divider"></div>

            <CreateTicketForm
              onSuccess={handleTicketSuccess}
              user={session.user}
            />

          </section>
        )}

        {session && showList && !selectedTicketId && (
          <section className="ticket-form-card">

            <PanelHeader
              label="ALL REQUESTS"
              title={session.user.role === 'employee' ? 'My Requests' : 'Support Requests'}
              description="View, filter and sort all submitted tickets. Click a row for details."
              onHome={goHome}
            />

            <div className="form-divider"></div>

            <TicketList
              onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
            />

          </section>
        )}

        {session && selectedTicketId && (
          <section className="ticket-form-card">

            <PanelHeader
              label="TICKET DETAIL"
              onBack={() => setSelectedTicketId(null)}
              onHome={goHome}
            />

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

            <PanelHeader
              label="OVERVIEW"
              title="Dashboard"
              description="Summary of all support requests."
              onHome={goHome}
            />

            <div className="form-divider"></div>

            <Dashboard user={session.user} />

          </section>
        )}

        {session && showRequestTracker && session.user.role === 'employee' && !selectedTicketId && (
          <section className="ticket-form-card request-tracker-page">
            <PanelHeader
              label="YOUR REQUESTS"
              title="Track Requests"
              description="Follow each request through the support process."
              onHome={goHome}
            />
            <div className="form-divider"></div>
            <RequestTracker onOpenTicket={(ticketId) => setSelectedTicketId(ticketId)} />
          </section>
        )}

        {session && showTeam && session.user.role === 'admin' && (
          <section className="ticket-form-card">
            <PanelHeader
              label="ADMINISTRATION"
              title="Staff Access"
              description="Create accounts, assign roles, reset passwords, and disable access."
              onHome={goHome}
            />
            <div className="form-divider"></div>
            <TeamManagement />
          </section>
        )}

        {session && showAccessRequests && session.user.role === 'admin' && (
          <section className="ticket-form-card">
            <PanelHeader
              label="ADMINISTRATION"
              title="Access Requests"
              description="Review Staff and Support Team account requests."
              onHome={goHome}
            />
            <div className="form-divider"></div>
            <AccessRequestReview />
          </section>
        )}

        {session && showProfile && (
          <section className="ticket-form-card">
            <PanelHeader
              label="ACCOUNT"
              title="My Profile"
              description="View your account details and manage settings."
              onHome={goHome}
            />
            <div className="form-divider"></div>
            <Profile user={session.user} />
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