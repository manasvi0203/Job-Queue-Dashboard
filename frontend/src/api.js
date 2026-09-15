// Base URL of the NestJS backend. Configurable via .env (VITE_API_URL) so
// the same build can point at localhost during dev and a deployed API in
// production.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Thin wrapper around fetch that:
 *  - always talks JSON
 *  - throws a normal Error with the backend's message on non-2xx responses,
 *    so callers can just try/catch and show err.message to the user.
 */
async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) {
    return null;
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. network-level failure page) - ignore
  }

  if (!res.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return body;
}

export const api = {
  listJobs: (status) =>
    request(`/jobs${status ? `?status=${encodeURIComponent(status)}` : ''}`),

  createJob: (data) =>
    request('/jobs', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id, status) =>
    request(`/jobs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
};
