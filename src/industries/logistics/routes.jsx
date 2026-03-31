import LogisticsDashboardPage from './pages/DashboardPage';
import LogisticsAlertCenterPage from './pages/AlertCenterPage';
import LogisticsShipmentRiskPage from './pages/ShipmentRiskPage';
import LogisticsDataUploadPage from './pages/DataUploadPage';
import LogisticsCompliancePage from './pages/CompliancePage';
import LogisticsRiskAnalyticsPage from './pages/RiskAnalyticsPage';
import LogisticsVendorIntelPage from './pages/VendorIntelPage';
export const logisticsDashboardRoutes = [
  { path: 'logistics',                      element: <LogisticsDashboardPage /> },
  { path: 'logistics/alerts',               element: <LogisticsAlertCenterPage /> },
  { path: 'logistics/shipment-risk',        element: <LogisticsShipmentRiskPage /> },
  { path: 'logistics/compliance',           element: <LogisticsCompliancePage /> },
  { path: 'logistics/risk-analytics',       element: <LogisticsRiskAnalyticsPage /> },
  { path: 'logistics/vendor-intel',         element: <LogisticsVendorIntelPage /> },
  { path: 'logistics/data',                 element: <LogisticsDataUploadPage /> },
];
