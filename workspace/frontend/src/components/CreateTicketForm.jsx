import { useState } from 'react'
import { apiFetch } from '../api'

function CreateTicketForm({ onSuccess, user }) {
  const isEmployee = user?.role === 'employee'
  const [formData, setFormData] = useState(() => ({
    title: '',
    description: '',
    requester_name: isEmployee ? user.name : '',
    requester_email: isEmployee ? user.email : '',
    category: '',
  }))

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
    }

    console.log('FORM DATA:', formData)
    console.log('PAYLOAD:', payload)
    console.log('JSON PAYLOAD:', JSON.stringify(payload))

    try {
      const response = await apiFetch('/requests', {
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
              readOnly={isEmployee}
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
              readOnly={isEmployee}
              required
            />
          </div>
        </div>

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