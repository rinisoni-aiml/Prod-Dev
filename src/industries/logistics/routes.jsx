import LogisticsDashboardPage from './pages/DashboardPage';
import LogisticsAlertCenterPage from './pages/AlertCenterPage';
import LogisticsShipmentRiskPage from './pages/ShipmentRiskPage';
import LogisticsDataUploadPage from './pages/DataUploadPage';

export const logisticsDashboardRoutes = [
  { path: 'logistics',              element: <LogisticsDashboardPage /> },
  { path: 'logistics/alerts',       element: <LogisticsAlertCenterPage /> },
  { path: 'logistics/shipment-risk', element: <LogisticsShipmentRiskPage /> },
  { path: 'logistics/data',         element: <LogisticsDataUploadPage /> },
];
