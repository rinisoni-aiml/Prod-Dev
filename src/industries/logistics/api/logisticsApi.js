import api from '@/lib/api';

// Views
export const getDashboardView = async () => {
  const response = await api.get('/api/logistics/v1/views/dashboard');
  return response.data;
};

export const getAlertsView = async (limit = 300) => {
  const response = await api.get('/api/logistics/v1/views/alerts', { params: { limit } });
  return response.data;
};

export const getComplianceView = async () => {
  const response = await api.get('/api/logistics/v1/views/compliance');
  return response.data;
};

export const getRiskAnalyticsView = async () => {
  const response = await api.get('/api/logistics/v1/views/risk-analytics');
  return response.data;
};

export const getShipmentRiskView = async (shipmentId = null, limit = 300) => {
  const response = await api.get('/api/logistics/v1/views/shipment-risk', {
    params: { shipment_id: shipmentId || undefined, limit },
  });
  return response.data;
};

export const getVendorIntelView = async (vendorId = null) => {
  const response = await api.get('/api/logistics/v1/views/vendor-intel', {
    params: { vendor_id: vendorId || undefined },
  });
  return response.data;
};

export const resolveAlert = async (shipmentId) => {
  const response = await api.post(`/api/logistics/v1/alerts/${shipmentId}/resolve`);
  return response.data?.data ?? response.data;
};

export const unresolveAlert = async (shipmentId) => {
  const response = await api.post(`/api/logistics/v1/alerts/${shipmentId}/unresolve`);
  return response.data?.data ?? response.data;
};

// AI Assistant
export const askAIAssistant = async (question, sessionId = '') => {
  const response = await api.post('/api/logistics/v1/ai/chat', { question, session_id: sessionId });
  return response.data?.data ?? response.data;
};

export const getChatSessions = async () => {
  const response = await api.get('/api/logistics/v1/ai/sessions');
  return response.data?.data ?? response.data;
};

export const getSessionMessages = async (sessionId) => {
  const response = await api.get(`/api/logistics/v1/ai/sessions/${sessionId}/messages`);
  return response.data?.data ?? response.data;
};

export const deleteChatSession = async (sessionId) => {
  const response = await api.delete(`/api/logistics/v1/ai/sessions/${sessionId}`);
  return response.data?.data ?? response.data;
};

// Upload
export const getUploadConfig = async () => {
  const response = await api.get('/api/logistics/v1/upload/config');
  return response.data?.data ?? response.data;
};

export const getUploadTableStats = async () => {
  const response = await api.get('/api/logistics/v1/upload/table-stats');
  return response.data?.data ?? response.data;
};

export const analyzeUploadFile = async (file, manualTable = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (manualTable) formData.append('manual_table', manualTable);
  const response = await api.post('/api/logistics/v1/upload/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data ?? response.data;
};

export const uploadExcelFileWithMapping = async (file, tableName = null, mapping = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) formData.append('manual_mapping_json', JSON.stringify(mapping));
  const url = tableName
    ? `/api/logistics/v1/upload?table_name=${encodeURIComponent(tableName)}`
    : '/api/logistics/v1/upload';
  const response = await api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data ?? response.data;
};
