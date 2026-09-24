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

    console.log('FORM DATA:', formData)
console.log('PAYLOAD:', payload)
console.log('JSON PAYLOAD:', JSON.stringify(payload))

    // This is the actual payload being sent to the API
    const payload = {
      title: formData.title,
      description: formData.description,
      requester_name: formData.requester_name,
      requester_email: formData.requester_email,
      category: formData.category,
      priority: formData.priority,
      due_date: formData.due_date,
    }

    console.log('Sending payload:', payload)

    try {
      const response = await fetch('http://localhost:8000/requests', {
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

      // Tell App that ticket creation was successful
      onSuccess(data)

    } catch (error) {
      console.error('Request failed:', error)
      setError(error.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Create Ticket</h2>

      <form onSubmit={handleSubmit}>

        <input
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <br />

        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          required
        />

        <br />

        <input
          name="requester_name"
          placeholder="Requester Name"
          value={formData.requester_name}
          onChange={handleChange}
          required
        />

        <br />

        <input
          name="requester_email"
          type="email"
          placeholder="Requester Email"
          value={formData.requester_email}
          onChange={handleChange}
          required
        />

        <br />

        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
        >
          <option value="">Select Category</option>
          <option value="Application">Application</option>
          <option value="Access">Access</option>
          <option value="Infrastructure">Infrastructure</option>
          <option value="Data">Data</option>
          <option value="Other">Other</option>
        </select>

        <br />

        <select
          name="priority"
          value={formData.priority}
          onChange={handleChange}
          required
        >
          <option value="">Select Priority</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <br />

        <input
          name="due_date"
          type="date"
          value={formData.due_date}
          onChange={handleChange}
        />

        <br />

        <button type="submit" disabled={loading}>
          {loading ? 'Creating Ticket...' : 'Submit Ticket'}
        </button>

      </form>

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default CreateTicketForm;
