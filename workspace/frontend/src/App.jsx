import { useState } from 'react'

function App() {
  const [showForm, setShowForm] = useState(false)
 const [formData, setFormData] = useState({
  title: '',
  description: '',
  requester_name: '',
  requester_email: '',
  category: '',
  priority: '',
  due_date: '',
})
   const handleSubmit = async () => {
  const response = await fetch('http://localhost:8000/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formData),
  })

  const data = await response.json()

  console.log(data)
}

  return (
    <div>
      <h1>Cloudnaut Support Desk</h1>

      <p>Manage and track support tickets.</p>

      <button onClick={() => setShowForm(true)}>
        Create Ticket
      </button>

    {showForm && (
  <div>
    <h2>Create Ticket</h2>

   <input
  placeholder="Title"
  value={formData.title}
  onChange={(event) =>
    setFormData({
      ...formData,
      title: event.target.value,
    })
  }
/>

    <textarea
  placeholder="Description"
  value={formData.description}
  onChange={(event) =>
    setFormData({
      ...formData,
      description: event.target.value,
    })
  }
/>

    <input
  placeholder="Requester Name"
  value={formData.requester_name}
  onChange={(event) =>
    setFormData({
      ...formData,
      requester_name: event.target.value,
    })
  }
/>

   <input
  type="email"
  placeholder="Requester Email"
  value={formData.requester_email}
  onChange={(event) =>
    setFormData({
      ...formData,
      requester_email: event.target.value,
    })
  }
/>

    <select
  value={formData.category}
  onChange={(event) =>
    setFormData({
      ...formData,
      category: event.target.value,
    })
  }
>
  <option value="">Select Category</option>
  <option value="Application">Application</option>
  <option value="Access">Access</option>
  <option value="Infrastructure">Infrastructure</option>
  <option value="Data">Data</option>
  <option value="Other">Other</option>
</select>

    <select
  value={formData.priority}
  onChange={(event) =>
    setFormData({
      ...formData,
      priority: event.target.value,
    })
  }
>
  <option value="">Select Priority</option>
  <option value="Low">Low</option>
  <option value="Medium">Medium</option>
  <option value="High">High</option>
  <option value="Critical">Critical</option>
</select>

    <input
  type="date"
  value={formData.due_date}
  onChange={(event) =>
    setFormData({
      ...formData,
      due_date: event.target.value,
    })
  }
/>
    <button onClick={handleSubmit}>Submit Ticket</button>
  </div>
)}
    </div>
  )
}

export default App