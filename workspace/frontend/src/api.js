const API_URL = 'http://localhost:4000'
const MIME_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
}

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
  const extension = file.name.split('.').pop()?.toLowerCase()
  const content = file.type
    ? file
    : new Blob([file], { type: MIME_TYPE_BY_EXTENSION[extension] || 'application/octet-stream' })
  body.append('file', content, file.name)
  return apiFetch(`/requests/${requestId}/attachments`, {
    method: 'POST',
    body,
  })
}

export function fetchRequestAttachment(attachmentId) {
  return apiFetch(`/attachments/${attachmentId}`)
}

export function deleteRequestAttachment(attachmentId) {
  return apiFetch(`/attachments/${attachmentId}`, {
    method: 'DELETE',
  })
}
