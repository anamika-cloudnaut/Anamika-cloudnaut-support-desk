const API_URL = 'http://localhost:4000'

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('supportDeskToken')
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (
    options.body &&
    !(typeof FormData !== 'undefined' && options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API_URL}${path}`, { ...options, headers })
}

export function listRequestAttachments(requestId) {
  return apiFetch(`/requests/${requestId}/attachments`)
}

export function uploadRequestAttachment(requestId, file) {
  const body = new FormData()
  body.append('file', file)
  return apiFetch(`/requests/${requestId}/attachments`, {
    method: 'POST',
    body,
  })
}

export function fetchRequestAttachment(attachmentId) {
  return apiFetch(`/attachments/${attachmentId}`)
}
