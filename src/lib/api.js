import axios from 'axios';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Supabase access token to every request
api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Shared: Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  signup: (email, password, full_name) => api.post('/api/auth/signup', { email, password, full_name }),
  getProfile: () => api.get('/api/auth/profile'),
  updateProfile: (data) => api.patch('/api/auth/profile', data),
};

// ── FMCG: Data ────────────────────────────────────────────────────────────────
export const dataApi = {
  upload: (formData) => api.post('/api/fmcg/data/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getSources: () => api.get('/api/fmcg/data/sources'),
  deleteSource: (id) => api.delete(`/api/fmcg/data/sources/${id}`),
};

// ── FMCG: Dashboard ───────────────────────────────────────────────────────────
export const dashboardApi = {
  getKPIs: () => api.get('/api/fmcg/dashboard/kpis'),
  getDemandTrend: (params) => api.get('/api/fmcg/dashboard/demand-trend', { params }),
  getTopSKUs: () => api.get('/api/fmcg/dashboard/top-skus'),
  getInventorySnapshot: () => api.get('/api/fmcg/dashboard/inventory-snapshot'),
};

// ── FMCG: Forecasting ─────────────────────────────────────────────────────────
export const forecastApi = {
  // Run XGBoost forecast on an uploaded file (all SKUs or a specific one)
  runForecast: (fileId, horizon, sku = null) =>
    api.post('/api/fmcg/forecasting/run', { file_id: fileId, horizon, sku }),
  // List SKUs available in an uploaded file (fast — no ML computation)
  getFileSKUs: (fileId) =>
    api.get('/api/fmcg/forecasting/file-skus', { params: { file_id: fileId } }),
  // Legacy: forecast from demand_history table
  getForecast: (params) => api.get('/api/fmcg/forecasting', { params }),
  getSeasonality: () => api.get('/api/fmcg/forecasting/seasonality'),
  getProducts: () => api.get('/api/fmcg/forecasting/products'),
};

// ── FMCG: Inventory ───────────────────────────────────────────────────────────
export const inventoryApi = {
  getOverview: () => api.get('/api/fmcg/inventory/overview'),
  getWarehouses: () => api.get('/api/fmcg/inventory/warehouses'),
  getWarehouseDetail: (id) => api.get(`/api/fmcg/inventory/warehouses/${id}`),
  getReorderQueue: () => api.get('/api/fmcg/inventory/reorder-queue'),
  getABCAnalysis: () => api.get('/api/fmcg/inventory/abc-analysis'),
  // Run inventory optimization (Safety Stock, ROP, EOQ) from an uploaded file
  runOptimization: (body) => api.post('/api/fmcg/inventory/optimize', body),
  // Fetch the latest stored optimization result (persisted across sessions)
  getLatestOptimization: () => api.get('/api/fmcg/inventory/latest-optimization'),
};

// ── FMCG: Contracts ───────────────────────────────────────────────────────────
export const contractsApi = {
  getAll: () => api.get('/api/fmcg/contracts'),
  create: (data) => api.post('/api/fmcg/contracts', data),
  update: (id, data) => api.patch(`/api/fmcg/contracts/${id}`, data),
  delete: (id) => api.delete(`/api/fmcg/contracts/${id}`),
};

// ── FMCG: Alerts ──────────────────────────────────────────────────────────────
export const alertsApi = {
  getAll: (params) => api.get('/api/fmcg/alerts', { params }),
  resolve: (id) => api.patch(`/api/fmcg/alerts/${id}/resolve`),
};

// ── FMCG: AI ──────────────────────────────────────────────────────────────────
export const aiApi = {
  getInsights: () => api.get('/api/fmcg/ai/insights'),
  chat: (sessionId, message) => api.post('/api/fmcg/ai/chat', { session_id: sessionId, message }),
  getSessions: () => api.get('/api/fmcg/ai/sessions'),
  createSession: () => api.post('/api/fmcg/ai/sessions'),
  getRecommendations: (context) => api.post('/api/fmcg/ai/recommendations', context),
};
