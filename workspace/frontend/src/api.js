const API_URL = 'http://localhost:4000'

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('supportDeskToken')
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API_URL}${path}`, { ...options, headers })
}
