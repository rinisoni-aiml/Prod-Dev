// Mock data for demo/development before FastAPI backend is connected

export const mockKPIs = [
  { label: 'Total SKUs Tracked', value: 247, trend: '+12%', icon: 'Package' },
  { label: 'Stockout Risk SKUs', value: 18, trend: '-3', icon: 'AlertTriangle' },
  { label: 'Avg Forecast Accuracy', value: 89.3, trend: '+2.1%', suffix: '%', icon: 'Target' },
  { label: 'Inventory Health Score', value: 74, trend: '+5', suffix: '/100', icon: 'Activity' },
];

export const mockDemandTrend = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().split('T')[0],
    units: Math.floor(Math.random() * 500) + 200,
    forecast: Math.floor(Math.random() * 500) + 200,
  };
});

export const mockTopSKUs = [
  { name: 'Wheat Flour 5kg', units_sold: 12450 },
  { name: 'Sunflower Oil 1L', units_sold: 9870 },
  { name: 'Basmati Rice 2kg', units_sold: 8340 },
  { name: 'Sugar 1kg', units_sold: 7650 },
  { name: 'Salt 500g', units_sold: 6230 },
];

export const mockInventorySnapshot = [
  { name: 'Optimal', value: 156, color: 'hsl(160, 84%, 39%)' },
  { name: 'Low Stock', value: 52, color: 'hsl(38, 92%, 50%)' },
  { name: 'Stockout', value: 18, color: 'hsl(0, 84%, 60%)' },
  { name: 'Overstock', value: 21, color: 'hsl(217, 91%, 60%)' },
];

export const mockAlerts = [
  { id: '1', alert_type: 'stockout', severity: 'critical', message: 'Wheat Flour 5kg stockout at Mumbai warehouse', sku: 'WF-5KG', warehouse: 'Mumbai-West', created_at: new Date().toISOString(), is_resolved: false },
  { id: '2', alert_type: 'low_stock', severity: 'high', message: 'Sunflower Oil 1L below safety stock at Delhi warehouse', sku: 'SO-1L', warehouse: 'Delhi-North', created_at: new Date(Date.now() - 3600000).toISOString(), is_resolved: false },
  { id: '3', alert_type: 'demand_spike', severity: 'medium', message: 'Sugar 1kg demand 2.3x higher than average this week', sku: 'SG-1KG', warehouse: 'All', created_at: new Date(Date.now() - 7200000).toISOString(), is_resolved: false },
  { id: '4', alert_type: 'contract_expiry', severity: 'high', message: 'Vendor contract with ABC Foods expiring in 15 days', sku: '-', warehouse: '-', created_at: new Date(Date.now() - 10800000).toISOString(), is_resolved: false },
];

export const mockContracts = [
  { id: '1', contract_name: 'Wheat Supply Q1-Q2', vendor: 'ABC Agro Ltd', start_date: '2025-01-01', end_date: '2025-06-30', value: 2500000, status: 'active', notes: 'Annual wheat procurement' },
  { id: '2', contract_name: 'Oil Distribution', vendor: 'PureOil Corp', start_date: '2025-03-01', end_date: '2025-04-15', value: 1200000, status: 'expiring_soon', notes: 'Monthly renewable' },
  { id: '3', contract_name: 'Packaging Materials', vendor: 'PackPro Industries', start_date: '2024-06-01', end_date: '2025-02-28', value: 800000, status: 'expired', notes: 'Needs renewal' },
];

export const mockWarehouses = [
  { id: '1', name: 'Mumbai-West', total_skus: 89, stockouts: 5, fill_rate: 78, status: 'warning' },
  { id: '2', name: 'Delhi-North', total_skus: 76, stockouts: 3, fill_rate: 85, status: 'good' },
  { id: '3', name: 'Bangalore-South', total_skus: 45, stockouts: 1, fill_rate: 92, status: 'good' },
  { id: '4', name: 'Kolkata-East', total_skus: 37, stockouts: 9, fill_rate: 62, status: 'critical' },
];

export const mockReorderQueue = [
  { sku: 'WF-5KG', product: 'Wheat Flour 5kg', current_stock: 12, daily_avg: 45, days_left: 0.3, urgency: 'critical', warehouse: 'Mumbai-West' },
  { sku: 'SO-1L', product: 'Sunflower Oil 1L', current_stock: 85, daily_avg: 32, days_left: 2.7, urgency: 'critical', warehouse: 'Delhi-North' },
  { sku: 'RC-2KG', product: 'Basmati Rice 2kg', current_stock: 150, daily_avg: 28, days_left: 5.4, urgency: 'high', warehouse: 'Mumbai-West' },
  { sku: 'SG-1KG', product: 'Sugar 1kg', current_stock: 200, daily_avg: 22, days_left: 9.1, urgency: 'medium', warehouse: 'Bangalore-South' },
];

export const mockABCAnalysis = [
  { category: 'A', count: 49, revenue_pct: 80, description: 'Top 20% SKUs' },
  { category: 'B', count: 74, revenue_pct: 15, description: 'Next 30% SKUs' },
  { category: 'C', count: 124, revenue_pct: 5, description: 'Remaining 50%' },
];

export const mockForecastData = Array.from({ length: 60 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - 30 + i);
  const isHistorical = i < 30;
  const base = 300 + Math.sin(i / 7) * 80;
  return {
    date: date.toISOString().split('T')[0],
    actual: isHistorical ? Math.floor(base + Math.random() * 60) : null,
    forecast: !isHistorical ? Math.floor(base + Math.random() * 40) : null,
    upper: !isHistorical ? Math.floor(base + 80) : null,
    lower: !isHistorical ? Math.floor(base - 40) : null,
  };
});

export const mockAIInsights = [
  { text: 'Wheat Flour 5kg demand projected to increase 18% next week based on seasonal patterns. Consider pre-stocking Mumbai-West warehouse.', confidence: 92 },
  { text: 'Kolkata-East warehouse fill rate dropped below 65%. 3 critical stockouts detected — immediate reorder recommended.', confidence: 88 },
  { text: 'Sugar 1kg shows unusual demand spike (2.3x avg). Likely driven by festive season. Pattern matches 2024 Diwali surge.', confidence: 85 },
];
