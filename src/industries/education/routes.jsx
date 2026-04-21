import DashboardPage from './pages/DashboardPage';
import AcademicIntelligencePage from './pages/AcademicIntelligencePage';
import AdmissionsRevenuePage from './pages/AdmissionsRevenuePage';
import DataUploadPage from './pages/DataUploadPage';
import FacultyStaffPage from './pages/FacultyStaffPage';
import PlacementsPage from './pages/PlacementsPage';
import UploadPage from './pages/UploadPage';

export const educationDashboardRoutes = [
  { path: 'education',                    element: <DashboardPage /> },
  { path: 'education/academic',           element: <AcademicIntelligencePage /> },
  { path: 'education/admissions',         element: <AdmissionsRevenuePage /> },
  { path: 'education/data-upload',        element: <DataUploadPage /> },
  { path: 'education/faculty',            element: <FacultyStaffPage /> },
  { path: 'education/placements',         element: <PlacementsPage /> },
  { path: 'education/upload',             element: <UploadPage /> },
];