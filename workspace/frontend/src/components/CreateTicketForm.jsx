import { useState } from 'react'
import { apiFetch, uploadRequestAttachment } from '../api'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const SUPPORTED_FILES = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  txt: ['text/plain'],
}

function validateSelectedFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const allowedTypes = SUPPORTED_FILES[extension]
  if (!allowedTypes) return 'This file type is not supported.'
  if (!file.size) return 'Empty files are not allowed.'
  if (file.size > MAX_FILE_SIZE) return 'Files must be 5 MB or smaller.'
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    return 'The file content type does not match its extension.'
  }
  return ''
}

function fileIdentity(file) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

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
  const [selectedFiles, setSelectedFiles] = useState([])
  const [fileErrors, setFileErrors] = useState([])
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [submitStatus, setSubmitStatus] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }))
  }

  const addFiles = (files) => {
    const additions = []
    const errors = []
    const knownFiles = new Set(selectedFiles.map(fileIdentity))

    Array.from(files).forEach((file) => {
      const validationError = validateSelectedFile(file)
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`)
      } else if (knownFiles.has(fileIdentity(file))) {
        errors.push(`${file.name}: This file is already selected.`)
      } else {
        knownFiles.add(fileIdentity(file))
        additions.push(file)
      }
    })

    setSelectedFiles((current) => [...current, ...additions])
    setFileErrors(errors)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setLoading(true)
    setError('')
    setFileErrors([])
    setSubmitStatus('Creating ticket...')

    const payload = {
      title: formData.title,
      description: formData.description,
      requester_name: formData.requester_name,
      requester_email: formData.requester_email,
      category: formData.category,
    }

    try {
      const response = await apiFetch('/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create ticket')
      }

      const failedFiles = []
      const uploadErrors = []
      for (const [index, file] of selectedFiles.entries()) {
        setSubmitStatus(`Uploading attachment ${index + 1} of ${selectedFiles.length}...`)
        try {
          const uploadResponse = await uploadRequestAttachment(data.id, file)
          const uploadData = await uploadResponse.json()
          if (!uploadResponse.ok) {
            throw new Error(uploadData.detail || 'Upload failed.')
          }
        } catch (uploadError) {
          failedFiles.push(file)
          uploadErrors.push(`${file.name}: ${uploadError.message || 'Upload failed.'}`)
        }
      }
      onSuccess(data, failedFiles, uploadErrors)
    } catch (error) {
      setError(error.message || 'Could not connect to the API.')
    } finally {
      setLoading(false)
      setSubmitStatus('')
    }
  }

  const supportedFileTypes = Object.keys(SUPPORTED_FILES).map((extension) => `.${extension}`).join(', ')

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

        <section className="attachment-picker" aria-labelledby="create-attachments-heading">
          <div className="attachment-picker-heading">
            <div>
              <h3 id="create-attachments-heading">Attachments (Optional)</h3>
              <p>Attach relevant screenshots or documents. Maximum 5 MB per file.</p>
            </div>
          </div>
          <label
            className={`attachment-dropzone${draggingFiles ? ' is-dragging' : ''}`}
            htmlFor="create-ticket-attachments"
            onDragOver={(dragEvent) => {
              dragEvent.preventDefault()
              setDraggingFiles(true)
            }}
            onDragLeave={() => setDraggingFiles(false)}
            onDrop={(dropEvent) => {
              dropEvent.preventDefault()
              setDraggingFiles(false)
              addFiles(dropEvent.dataTransfer.files)
            }}
          >
            <span className="attachment-dropzone-icon" aria-hidden="true">＋</span>
            <span><strong>Add files</strong> or drag and drop them here</span>
            <small>{supportedFileTypes} · up to 5 MB each</small>
            <input
              id="create-ticket-attachments"
              type="file"
              multiple
              accept={supportedFileTypes}
              onChange={(changeEvent) => {
                addFiles(changeEvent.target.files)
                changeEvent.target.value = ''
              }}
              disabled={loading}
            />
          </label>

          {fileErrors.length > 0 && (
            <div className="error-box" role="alert">
              <strong>Some files could not be added</strong>
              {fileErrors.map((message) => <span key={message}>{message}</span>)}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <ul className="selected-attachments">
              {selectedFiles.map((file) => (
                <li key={fileIdentity(file)}>
                  <span className="selected-attachment-icon" aria-hidden="true">📎</span>
                  <span className="selected-attachment-info">
                    <strong>{file.name}</strong>
                    <small>{file.type || file.name.split('.').pop()?.toUpperCase()} · {formatFileSize(file.size)}</small>
                  </span>
                  <button
                    type="button"
                    className="remove-attachment-button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setSelectedFiles((current) => current.filter((item) => fileIdentity(item) !== fileIdentity(file)))}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

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
          {loading ? submitStatus : 'Submit Support Request'}
        </button>

      </form>
    </div>
  )
}

export default CreateTicketForm