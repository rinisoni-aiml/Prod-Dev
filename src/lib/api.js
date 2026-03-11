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

// Auth
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  signup: (email, password, full_name) => api.post('/api/auth/signup', { email, password, full_name }),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data) => api.patch('/api/auth/profile', data),
};

// Data
export const dataApi = {
  upload: (formData) => api.post('/api/data/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getSources: () => api.get('/api/data/sources'),
  deleteSource: (id) => api.delete(`/api/data/sources/${id}`),
};

// Dashboard
export const dashboardApi = {
  getKPIs: () => api.get('/api/dashboard/kpis'),
  getDemandTrend: (params) => api.get('/api/dashboard/demand-trend', { params }),
  getTopSKUs: () => api.get('/api/dashboard/top-skus'),
  getInventorySnapshot: () => api.get('/api/dashboard/inventory-snapshot'),
  getAlerts: (params) => api.get('/api/alerts', { params }),
};

// Forecasting
export const forecastApi = {
  getForecast: (params) => api.get('/api/forecasting', { params }),
  getSeasonality: () => api.get('/api/forecasting/seasonality'),
  getProducts: () => api.get('/api/forecasting/products'),
};

// Inventory
export const inventoryApi = {
  getOverview: () => api.get('/api/inventory/overview'),
  getWarehouses: () => api.get('/api/inventory/warehouses'),
  getWarehouseDetail: (id) => api.get(`/api/inventory/warehouses/${id}`),
  getReorderQueue: () => api.get('/api/inventory/reorder-queue'),
  getABCAnalysis: () => api.get('/api/inventory/abc-analysis'),
};

// Contracts
export const contractsApi = {
  getAll: () => api.get('/api/contracts'),
  create: (data) => api.post('/api/contracts', data),
  update: (id, data) => api.patch(`/api/contracts/${id}`, data),
  delete: (id) => api.delete(`/api/contracts/${id}`),
};

// Alerts
export const alertsApi = {
  getAll: (params) => api.get('/api/alerts', { params }),
  resolve: (id) => api.patch(`/api/alerts/${id}/resolve`),
};

// AI
export const aiApi = {
  getInsights: () => api.get('/api/ai/insights'),
  chat: (sessionId, message) => api.post('/api/ai/chat', { session_id: sessionId, message }),
  getSessions: () => api.get('/api/ai/sessions'),
  createSession: () => api.post('/api/ai/sessions'),
  getRecommendations: (context) => api.post('/api/ai/recommendations', { context }),
};
