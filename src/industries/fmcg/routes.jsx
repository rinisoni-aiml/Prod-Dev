/**
 * FMCG Industry Routes
 *
 * Exports all route definitions for the FMCG industry.
 * These are imported by src/App.jsx and spread into the main router.
 *
 * URL prefix: /dashboard/* (shared shell) and /fmcg/* (if industry-specific)
 *
 * To add a new FMCG page:
 *   1. Create the page in src/industries/fmcg/pages/
 *   2. Import it here
 *   3. Add a route object to fmcgRoutes
 *   4. Done — App.jsx picks it up automatically
 */

import DashboardPage from './pages/DashboardPage';
import ForecastingPage from './pages/ForecastingPage';
import InventoryPage from './pages/InventoryPage';
import ContractsAlertsPage from './pages/ContractsAlertsPage';
import DataUploadPage from './pages/DataUploadPage';

/**
 * Routes rendered inside the shared /dashboard AppLayout shell.
 * Each { path, element } will be mounted as a child of the /dashboard parent route.
 *
 * Example: path: "forecasting" → full URL is /dashboard/forecasting
 */
export const fmcgDashboardRoutes = [
  { index: true, element: <DashboardPage /> },
  { path: 'forecasting', element: <ForecastingPage /> },
  { path: 'inventory', element: <InventoryPage /> },
  { path: 'contracts', element: <ContractsAlertsPage /> },
  { path: 'data', element: <DataUploadPage /> },
];
