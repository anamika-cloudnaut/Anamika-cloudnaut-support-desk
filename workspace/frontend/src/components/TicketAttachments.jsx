import { useEffect, useRef, useState } from 'react'
import {
  fetchRequestAttachment,
  listRequestAttachments,
  uploadRequestAttachment,
} from '../api'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function TicketAttachments({ requestId }) {
  const [attachments, setAttachments] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const previewUrl = useRef(null)

  useEffect(() => {
    setPreview(null)
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

  const handleUpload = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!selectedFile) {
      setError('Choose an image to upload.')
      return
    }
    if (!ALLOWED_TYPES.has(selectedFile.type)) {
      setError('Only JPEG, PNG, and WebP images are supported.')
      return
    }
    if (selectedFile.size === 0) {
      setError('Empty files are not allowed.')
      return
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Files must be 5 MB or smaller.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const response = await uploadRequestAttachment(requestId, selectedFile)
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not upload image.')
      setAttachments((current) => [data, ...current])
      setSelectedFile(null)
      form.reset()
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  const loadContent = async (attachment) => {
    const response = await fetchRequestAttachment(attachment.id)
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.detail || 'Could not retrieve this image.')
    }
    return URL.createObjectURL(await response.blob())
  }

  const handlePreview = async (attachment) => {
    setError('')
    try {
      if (preview?.id === attachment.id) {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
        previewUrl.current = null
        setPreview(null)
        return
      }
      const nextUrl = await loadContent(attachment)
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = nextUrl
      setPreview({ id: attachment.id, url: nextUrl, name: attachment.original_filename })
    } catch (previewError) {
      setError(previewError.message || 'Could not retrieve this image.')
    }
  }

  const handleDownload = async (attachment) => {
    setError('')
    try {
      const url = await loadContent(attachment)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.original_filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download this image.')
    }
  }

  return (
    <section aria-labelledby="ticket-attachments-heading">
      <div className="form-divider"></div>
      <h3 id="ticket-attachments-heading">Attachments</h3>

      <form className="ticket-form" onSubmit={handleUpload}>
        <div className="form-group">
          <label htmlFor="ticket-attachment">Add an image (JPEG, PNG, or WebP; max 5 MB)</label>
          <input
            id="ticket-attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            disabled={uploading}
          />
        </div>
        <button type="submit" className="submit-button" disabled={uploading || !selectedFile}>
          {uploading ? 'Uploading...' : 'Upload image'}
        </button>
      </form>

      {error && (
        <div className="error-box" role="alert">
          <strong>Attachment action failed</strong>
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <figure>
          <img
            src={preview.url}
            alt={preview.name}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '360px' }}
          />
          <figcaption>{preview.name}</figcaption>
        </figure>
      )}

      {loading ? (
        <p>Loading attachments...</p>
      ) : attachments.length === 0 ? (
        <p>No attachments yet.</p>
      ) : (
        <ul className="notes-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span>
                {attachment.original_filename} ({(attachment.size_bytes / 1024).toFixed(1)} KB)
              </span>
              <span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handlePreview(attachment)}
                >
                  {preview?.id === attachment.id ? 'Close preview' : 'Preview'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleDownload(attachment)}
                >
                  Download
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
