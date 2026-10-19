// API base URL. Configurable at build time via Vite's VITE_API_URL env var so
// the same source deploys anywhere (CloudFront build points this at the ALB).
// Falls back to localhost for local dev / docker-compose.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
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

import { getIdToken, changePassword as cognitoChangePassword } from './cognito'

export async function apiFetch(path, options = {}) {
  // Prefer a fresh Cognito ID token (auto-refreshed by the SDK); fall back to
  // the stored token so already-open sessions keep working.
  let token = null
  try {
    token = await getIdToken()
  } catch {
    token = null
  }
  if (!token) token = localStorage.getItem('supportDeskToken')

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

export function getDashboardSummary() {
  return apiFetch('/dashboard/summary')
}

// Change password now goes through Cognito (not the custom backend endpoint).
export function changePassword(currentPassword, newPassword) {
  return cognitoChangePassword(currentPassword, newPassword)
}

// Supported server-side filters on GET /requests. Anything else is ignored so
// the frontend never silently relies on an unsupported param.
const REQUEST_FILTER_KEYS = [
  'status',
  'assigned_to',
  'assignment',
  'category',
  'priority',
  'created_from',
  'created_to',
  'sort_by',
  'sort_order',
]

export function buildRequestQuery(filters = {}) {
  const params = new URLSearchParams()
  for (const key of REQUEST_FILTER_KEYS) {
    const value = filters[key]
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `/requests?${query}` : '/requests'
}

export function listRequests(filters = {}) {
  return apiFetch(buildRequestQuery(filters))
}

export function listAccessRequests(status = 'pending') {
  return apiFetch(`/access-requests?status=${encodeURIComponent(status)}`)
}

export function listTeamMembers(activeOnly = false) {
  return apiFetch(`/team-members?active_only=${activeOnly ? 'true' : 'false'}`)
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
