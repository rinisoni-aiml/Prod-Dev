import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pulseiq-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pulseiq-token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  signup: (email, password, full_name) => api.post('/api/auth/signup', { email, password, full_name }),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data) => api.patch('/api/auth/profile', data),
};

// ── Education - Data Upload ───────────────────────────────────────────
export const dataApi = {
  upload: (formData) => api.post('/api/education/data/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  runQuery: (sql) => api.post('/api/education/data/run_query', { sql }),
};

// ── Education - Dashboard ─────────────────────────────────────────────
export const dashboardApi = {
  getMainDashboard: () => api.get('/api/education/dashboard/generate_dashboard'),
  getTablesCount: () => api.get('/api/education/stats/tables_count'),
};

// ── Education - Stats ─────────────────────────────────────────────────
export const statsApi = {
  getStats: () => api.get('/api/education/stats/stats'),
};

// ── Education - Section Analytics ────────────────────────────────────
export const analyticsApi = {
  getAcademic: () => api.get('/api/education/analytics/academic'),
  getAdmissions: () => api.get('/api/education/analytics/admissions'),
  getFaculty: () => api.get('/api/education/analytics/faculty'),
  getPlacements: () => api.get('/api/education/analytics/placements'),
};

// ── Education - AI Chat ───────────────────────────────────────────────
export const aiApi = {
  chat: (sessionId, message) => api.get('/api/education/ai/ask', {
    params: { question: message }
  }),
};

// ── FMCG - Forecasting ────────────────────────────────────────────────
export const forecastApi = {
  getForecast: (params) => api.get('/api/fmcg/forecasting', { params }),
  getSeasonality: () => api.get('/api/fmcg/forecasting/seasonality'),
  getProducts: () => api.get('/api/fmcg/forecasting/products'),
};

// ── FMCG - Inventory ──────────────────────────────────────────────────
export const inventoryApi = {
  getOverview: () => api.get('/api/fmcg/inventory/overview'),
  getWarehouses: () => api.get('/api/fmcg/inventory/warehouses'),
  getWarehouseDetail: (id) => api.get(`/api/fmcg/inventory/warehouses/${id}`),
  getReorderQueue: () => api.get('/api/fmcg/inventory/reorder-queue'),
  getABCAnalysis: () => api.get('/api/fmcg/inventory/abc-analysis'),
};

// ── FMCG - Contracts ──────────────────────────────────────────────────
export const contractsApi = {
  getAll: () => api.get('/api/fmcg/contracts'),
  create: (data) => api.post('/api/fmcg/contracts', data),
  update: (id, data) => api.patch(`/api/fmcg/contracts/${id}`, data),
  delete: (id) => api.delete(`/api/fmcg/contracts/${id}`),
};

// ── FMCG - Alerts ─────────────────────────────────────────────────────
export const alertsApi = {
  getAll: (params) => api.get('/api/fmcg/alerts', { params }),
  resolve: (id) => api.patch(`/api/fmcg/alerts/${id}/resolve`),
};