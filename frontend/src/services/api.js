/**
 * TechNova Enterprise AI - Unified API Service
 * Handles authenticated communication with the FastAPI backend.
 */

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem('technova_jwt_token');
  const headers = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}, useRoot = false) {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const url = useRoot ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      // ignore parse failure
    }
    throw new ApiError(errorDetail, response.status);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}

export const api = {
  // System Health
  async getHealth() {
    return await request('/health', {}, true);
  },

  // Authentication
  async login(username, password) {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.access_token) {
      localStorage.setItem('technova_jwt_token', res.access_token);
      localStorage.setItem('technova_current_user', JSON.stringify(res.user));
    }
    return res;
  },

  async getCurrentUser() {
    return await request('/auth/me');
  },

  async listUsers() {
    return await request('/auth/users');
  },

  async createUser(payload) {
    return await request('/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async updateUserStatus(userId, isActive) {
    return await request(`/auth/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  logout() {
    localStorage.removeItem('technova_jwt_token');
    localStorage.removeItem('technova_current_user');
  },

  // RAG Query (matches RAGQuery schema: query, top_k, include_historical, model_name, temperature)
  async askQuestion(
    query,
    includeHistorical = false,
    topK = 4,
    temperature = 0.1,
    modelName = 'llama3.2:latest'
  ) {
    return await request('/query/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        top_k: topK,
        include_historical: includeHistorical,
        temperature,
        model_name: modelName,
      }),
    });
  },

  // Streaming RAG Query
  async streamQuestion(
    query,
    includeHistorical = false,
    onToken,
    onDone,
    onError,
    topK = 4
  ) {
    const headers = getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    try {
      const response = await fetch(`${API_BASE}/query/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          top_k: topK,
          include_historical: includeHistorical,
        }),
      });

      if (!response.ok) {
        let errDetail = 'Streaming query failed';
        try {
          const err = await response.json();
          errDetail = err.detail || errDetail;
        } catch {
          // ignore
        }
        throw new ApiError(errDetail, response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (onToken) onToken(chunk);
      }

      if (onDone) onDone();
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },

  // Hybrid Search (matches RetrievalQuery schema: query, top_k, include_historical)
  async searchKnowledge(query, topK = 5, includeHistorical = false, targetDocumentId = null) {
    const payload = {
      query,
      top_k: topK,
      include_historical: includeHistorical,
    };
    if (targetDocumentId) {
      payload.target_document_id = targetDocumentId;
    }

    return await request('/query/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // Documents
  async listDocuments(category = null) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return await request(`/documents${query}`);
  },

  async uploadDocument(formData) {
    const token = localStorage.getItem('technova_jwt_token');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = 'Upload failed';
      try {
        const err = await response.json();
        errorDetail = err.detail || errorDetail;
      } catch {
        // ignore
      }
      throw new ApiError(errorDetail, response.status);
    }
    return await response.json();
  },

  // Audit Logs (Admin only)
  async getAuditLogs(action = null, outcome = null, limit = 100, offset = 0) {
    const params = new URLSearchParams();
    if (action) params.append('action', action);
    if (outcome) params.append('outcome', outcome);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    return await request(`/audit/logs?${params.toString()}`);
  },
};
