import { useState } from 'react'

function CreateTicketForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requester_name: '',
    requester_email: '',
    category: '',
    priority: '',
    due_date: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setLoading(true)
    setError('')

    const payload = {
      title: formData.title,
      description: formData.description,
      requester_name: formData.requester_name,
      requester_email: formData.requester_email,
      category: formData.category,
      priority: formData.priority,
      due_date: formData.due_date || null,
    }

    console.log('FORM DATA:', formData)
    console.log('PAYLOAD:', payload)
    console.log('JSON PAYLOAD:', JSON.stringify(payload))

    try {
      const response = await fetch('http://localhost:4000/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      console.log('API response:', data)

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create ticket')
      }

      onSuccess(data)
    } catch (error) {
      console.error('Request failed:', error)
      setError(error.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-ticket-form">
      <form onSubmit={handleSubmit} className="ticket-form">

        <div className="form-group">
          <label htmlFor="title">Ticket Title</label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="e.g. Laptop WiFi is not working"
            value={formData.title}
            onChange={handleChange}
            maxLength={200}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="Describe the issue in detail..."
            value={formData.description}
            onChange={handleChange}
            maxLength={5000}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="requester_name">Requester Name</label>
            <input
              id="requester_name"
              name="requester_name"
              type="text"
              placeholder="Your name"
              value={formData.requester_name}
              onChange={handleChange}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="requester_email">Requester Email</label>
            <input
              id="requester_email"
              name="requester_email"
              type="email"
              placeholder="you@example.com"
              value={formData.requester_email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select category</option>
              <option value="Application">Application</option>
              <option value="Access">Access</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Data">Data</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              required
            >
              <option value="">Select priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="due_date">Due Date</label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
          />
        </div>

        {error && (
          <div className="error-box">
            <strong>Unable to create ticket</strong>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Creating Ticket...' : 'Submit Support Request'}
        </button>

      </form>
    </div>
  )
}

export default CreateTicketForm