import { useEffect, useRef, useState } from 'react'
import {
  deleteRequestAttachment,
  fetchRequestAttachment,
  listRequestAttachments,
  uploadRequestAttachment,
} from '../api'

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
const PREVIEW_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function validateFile(file) {
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

function TicketAttachments({ requestId, initialFiles = [] }) {
  const [attachments, setAttachments] = useState([])
  const [selectedFiles, setSelectedFiles] = useState(initialFiles)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [fileErrors, setFileErrors] = useState([])
  const [draggingFiles, setDraggingFiles] = useState(false)
  const [preview, setPreview] = useState(null)
  const previewUrl = useRef(null)

  useEffect(() => {
    loadAttachments()
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const loadAttachments = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await listRequestAttachments(requestId)
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not load attachments.')
      setAttachments(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load attachments.')
    } finally {
      setLoading(false)
    }
  }

  const addFiles = (files) => {
    const additions = []
    const errors = []
    const identities = new Set(selectedFiles.map(fileIdentity))

    Array.from(files).forEach((file) => {
      const validationError = validateFile(file)
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`)
      } else if (identities.has(fileIdentity(file))) {
        errors.push(`${file.name}: This file is already selected.`)
      } else if (attachments.some(
        (attachment) => attachment.original_filename === file.name && attachment.size_bytes === file.size,
      )) {
        errors.push(`${file.name}: This file is already attached to this ticket.`)
      } else {
        identities.add(fileIdentity(file))
        additions.push(file)
      }
    })

    setSelectedFiles((current) => [...current, ...additions])
    setFileErrors(errors)
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!selectedFiles.length) return

    setUploading(true)
    setError('')
    setFileErrors([])
    const failedFiles = []
    const uploadErrors = []

    for (const file of selectedFiles) {
      try {
        const response = await uploadRequestAttachment(requestId, file)
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Upload failed.')
        setAttachments((current) => [data, ...current])
      } catch (uploadError) {
        failedFiles.push(file)
        uploadErrors.push(`${file.name}: ${uploadError.message || 'Upload failed.'}`)
      }
    }

    setSelectedFiles(failedFiles)
    setFileErrors(uploadErrors)
    setUploading(false)
  }

  const getObjectUrl = async (attachment) => {
    const response = await fetchRequestAttachment(attachment.id)
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.detail || 'Could not retrieve this attachment.')
    }
    return URL.createObjectURL(await response.blob())
  }

  const handleView = async (attachment) => {
    setError('')
    try {
      if (preview?.id === attachment.id) {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = null
        setPreview(null)
        return
      }
      const url = await getObjectUrl(attachment)
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = url
      setPreview({
        id: attachment.id,
        url,
        name: attachment.original_filename,
        contentType: attachment.content_type,
      })
    } catch (viewError) {
      setError(viewError.message || 'Could not open this attachment.')
    }
  }

  const handleDownload = async (attachment) => {
    setError('')
    try {
      const url = await getObjectUrl(attachment)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.original_filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download this attachment.')
    }
  }

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.original_filename}?`)) return
    setDeletingId(attachment.id)
    setError('')
    try {
      const response = await deleteRequestAttachment(attachment.id)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not delete this attachment.')
      }
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
      if (preview?.id === attachment.id) {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = null
        setPreview(null)
      }
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this attachment.')
    } finally {
      setDeletingId(null)
    }
  }

  const supportedFileTypes = Object.keys(SUPPORTED_FILES).map((extension) => `.${extension}`).join(', ')

  return (
    <section className="ticket-attachments" aria-labelledby={`ticket-attachments-heading-${requestId}`}>
      <div className="form-divider"></div>
      <h3 id={`ticket-attachments-heading-${requestId}`}>Attachments</h3>

      <label
        className={`attachment-dropzone${draggingFiles ? ' is-dragging' : ''}`}
        htmlFor={`ticket-attachment-input-${requestId}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDraggingFiles(true)
        }}
        onDragLeave={() => setDraggingFiles(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDraggingFiles(false)
          addFiles(event.dataTransfer.files)
        }}
      >
        <span className="attachment-dropzone-icon" aria-hidden="true">＋</span>
        <span><strong>Add files</strong> or drag and drop them here</span>
        <small>{supportedFileTypes} · up to 5 MB each</small>
        <input
          id={`ticket-attachment-input-${requestId}`}
          type="file"
          multiple
          accept={supportedFileTypes}
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
          disabled={uploading || deletingId !== null}
        />
      </label>

      {fileErrors.length > 0 && (
        <div className="error-box" role="alert">
          <strong>Attachment issue</strong>
          {fileErrors.map((message, index) => <span key={`${message}-${index}`}>{message}</span>)}
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          <strong>Attachment action failed</strong>
          <span>{error}</span>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <form className="ticket-form selected-attachments-form" onSubmit={handleUpload}>
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
                  onClick={() => setSelectedFiles((current) => current.filter((item) => fileIdentity(item) !== fileIdentity(file)))}
                  disabled={uploading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="submit" className="submit-button" disabled={uploading}>
            {uploading ? 'Uploading attachments...' : `Upload ${selectedFiles.length} attachment${selectedFiles.length === 1 ? '' : 's'}`}
          </button>
        </form>
      )}

      {preview && (
        <figure className="attachment-preview">
          {preview.contentType === 'application/pdf' ? (
            <iframe title={preview.name} src={preview.url} />
          ) : (
            <img src={preview.url} alt={preview.name} />
          )}
          <figcaption>{preview.name}</figcaption>
        </figure>
      )}

      {loading ? (
        <p>Loading attachments...</p>
      ) : attachments.length === 0 ? (
        <p>No attachments yet.</p>
      ) : (
        <ul className="notes-list attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span className="attachment-metadata">
                <strong>{attachment.original_filename}</strong>
                <small>
                  {attachment.content_type} · {formatFileSize(attachment.size_bytes)}
                  {attachment.created_at && ` · ${new Date(attachment.created_at).toLocaleString()}`}
                </small>
              </span>
              <span className="attachment-actions">
                {PREVIEW_TYPES.has(attachment.content_type) && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleView(attachment)}
                    disabled={deletingId === attachment.id}
                  >
                    {preview?.id === attachment.id ? 'Close view' : 'View'}
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleDownload(attachment)}
                  disabled={deletingId === attachment.id}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="remove-attachment-button"
                  onClick={() => handleDelete(attachment)}
                  disabled={deletingId === attachment.id}
                >
                  {deletingId === attachment.id ? 'Deleting...' : 'Delete'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default TicketAttachments
