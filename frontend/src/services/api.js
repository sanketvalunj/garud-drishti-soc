const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getToken = () => localStorage.getItem('cryptix_token')

const getHeaders = (isFormData = false) => {
  const token = getToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, options)
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

export const api = {
  login: (username, password, role) =>
    request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
      headers: getHeaders(),
    }),

  getIncidents: (params = {}) =>
    request(`/incidents?${new URLSearchParams(params)}`, {
      headers: getHeaders(),
    }),

  getIncident: (id) =>
    request(`/incidents/${id}`, {
      headers: getHeaders(),
    }),

  updateIncidentStatus: (id, status) =>
    request(`/incidents/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    }),

  escalateIncident: (id, data) =>
    request(`/incidents/${id}/escalate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }),

  shareReport: (id, data) =>
    request(`/incidents/${id}/share`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }),

  activateResponse: (incidentId) =>
    request(`/incidents/${incidentId}/activate-response`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ incidentId }),
    }),

  getPlaybooks: (params = {}) =>
    request(`/playbooks?${new URLSearchParams(params)}`, {
      headers: getHeaders(),
    }),

  getPlaybook: (id) =>
    request(`/playbooks/${id}`, {
      headers: getHeaders(),
    }),

  updateStepStatus: (playbookId, stepId, status) =>
    request(`/playbooks/${playbookId}/steps/${stepId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    }),

  reviewPlaybook: (playbookId) =>
    request(`/playbooks/${playbookId}/review`, {
      method: 'POST',
      headers: getHeaders(),
    }),

  runPipeline: () =>
    request('/admin/run-pipeline', {
      method: 'POST',
      headers: getHeaders(),
    }),

  getPipelineStatus: () =>
    request('/admin/pipeline-status', {
      headers: getHeaders(),
    }),

  getPipelineHistory: () =>
    request('/admin/pipeline-history', {
      headers: getHeaders(),
    }),

  ingestLogs: (formData) =>
    request('/admin/ingest-logs', {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    }),

  getReasoning: (incidentId) =>
    request(`/reasoning/${incidentId}`, {
      headers: getHeaders(),
    }),

  getSuspiciousUsers: () =>
    request('/admin/suspicious-users', {
      headers: getHeaders(),
    }),

  isolateUser: (userId) =>
    request(`/admin/suspicious-users/${userId}/isolate`, {
      method: 'POST',
      headers: getHeaders(),
    }),

  getTeam: () =>
    request('/admin/team', {
      headers: getHeaders(),
    }),

  getAuditTrail: () =>
    request('/admin/audit-trail', {
      headers: getHeaders(),
    }),

  getStats: () =>
    request('/admin/stats', {
      headers: getHeaders(),
    }),

  getHealth: () =>
    request('/admin/health', {
      headers: getHeaders(),
    }),
}

export default api
