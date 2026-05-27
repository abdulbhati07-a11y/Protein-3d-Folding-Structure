/**
 * API Helper Functions
 * 
 * Provides a centralized interface to interact with the backend API.
 * All functions assume a valid access token is available for authenticated endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `API Error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// ============================================================================
// Profile API Functions
// ============================================================================

export async function fetchProfile(token) {
  const data = await apiRequest('/users/profile', { method: 'GET' }, token);
  return data.profile;
}

export async function updateProfile(token, profileData) {
  const data = await apiRequest(
    '/users/profile',
    {
      method: 'PUT',
      body: JSON.stringify(profileData),
    },
    token,
  );
  return data;
}

// ============================================================================
// Projects API Functions
// ============================================================================

export async function fetchProjects(token, limit = 50) {
  const data = await apiRequest(
    `/users/projects?limit=${limit}`,
    { method: 'GET' },
    token,
  );
  return data.projects;
}

export async function createProject(token, name, description = '') {
  const data = await apiRequest(
    '/users/projects',
    {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    },
    token,
  );
  return data;
}

export async function updateProject(token, projectId, name = null, description = null) {
  const payload = {};
  if (name !== null) payload.name = name;
  if (description !== null) payload.description = description;

  const data = await apiRequest(
    `/users/projects/${projectId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    token,
  );
  return data;
}

export async function deleteProject(token, projectId) {
  const data = await apiRequest(
    `/users/projects/${projectId}`,
    { method: 'DELETE' },
    token,
  );
  return data;
}

// ============================================================================
// Predictions API Functions
// ============================================================================

export async function predict(token, sequence) {
  const data = await apiRequest(
    '/predictions/predict',
    {
      method: 'POST',
      body: JSON.stringify({ sequence }),
    },
    token,
  );
  return data;
}

export async function fetchPredictionHistory(token, limit = 10) {
  const data = await apiRequest(
    `/predictions/history?limit=${limit}`,
    { method: 'GET' },
    token,
  );
  return Array.isArray(data) ? data : data.history || [];
}

export async function fetchPrediction(token, predictionId) {
  const data = await apiRequest(
    `/predictions/history/${predictionId}`,
    { method: 'GET' },
    token,
  );
  return data;
}

export async function deletePrediction(token, predictionId) {
  const data = await apiRequest(
    `/predictions/history/${predictionId}`,
    { method: 'DELETE' },
    token,
  );
  return data;
}

export async function updatePredictionSharing(
  token,
  predictionId,
  isPublic = false,
  notes = null,
  tags = [],
) {
  const payload = { is_public: isPublic };
  if (notes !== null) payload.notes = notes;
  if (tags && tags.length > 0) payload.tags = tags;

  const data = await apiRequest(
    `/predictions/history/${predictionId}/share`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    token,
  );
  return data;
}

// ============================================================================
// Public Predictions API Functions (No Auth Required)
// ============================================================================

export async function fetchPublicPredictions(limit = 50) {
  const data = await apiRequest(
    `/predictions/public/predictions?limit=${limit}`,
    { method: 'GET' },
  );
  return data.predictions || [];
}

export async function fetchPublicPrediction(predictionId) {
  const data = await apiRequest(
    `/predictions/public/predictions/${predictionId}`,
    { method: 'GET' },
  );
  return data;
}
