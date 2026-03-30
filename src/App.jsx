import { useEffect } from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// ── Shared pages (same for every industry) ───────────────────────────────────
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import AppLayout from "./components/layout/AppLayout";
import NotFound from "./pages/NotFound";

// ── Industry routes ───────────────────────────────────────────────────────────
// Each industry exports fmcgDashboardRoutes (or equivalent) — an array of
// { path, element } objects that are mounted inside the /dashboard shell.
// To add a new industry: import its routes here and spread into the router below.
import { fmcgDashboardRoutes } from './industries/fmcg/routes';
import { logisticsDashboardRoutes } from './industries/logistics/routes';
import DashboardPage from './industries/fmcg/pages/DashboardPage';
import { LogisticsAppProvider } from './industries/logistics/context/LogisticsAppContext';

const queryClient = new QueryClient();

// Routes logistics users away from the FMCG index to their own home
const IndustryHome = () => {
  const { profile } = useAuthStore();
  if (profile?.industry === 'logistics') {
    return <Navigate to="/dashboard/logistics" replace />;
  }
  return <DashboardPage />;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

const AuthInitializer = ({ children }) => {
  const { setUser, setProfile, setLoading, fetchProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        // After email confirmation, redirect to onboarding or dashboard
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          fetchProfile(session.user.id).then((profile) => {
            const publicPaths = ['/', '/login', '/signup'];
            if (publicPaths.includes(window.location.pathname)) {
              if (profile?.onboarding_completed) {
                navigate('/dashboard');
              } else {
                navigate('/onboarding');
              }
            }
          });
        } else {
          fetchProfile(session.user.id);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            {/* ── Public pages ───────────────────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboarding" element={
              <ProtectedRoute><OnboardingPage /></ProtectedRoute>
            } />

            {/* ── Dashboard shell — industry pages render as children ─────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute><LogisticsAppProvider><AppLayout /></LogisticsAppProvider></ProtectedRoute>
            }>
              <Route index element={<IndustryHome />} />
              {fmcgDashboardRoutes.filter(r => !r.index).map((route, i) =>
                <Route key={i} path={route.path} element={route.element} />
              )}
              {logisticsDashboardRoutes.map((route, i) =>
                <Route key={`logistics-${i}`} path={route.path} element={route.element} />
              )}
            </Route>

            {/* ── Shared authenticated pages ──────────────────────────────── */}
            <Route path="/profile" element={
              <ProtectedRoute><AppLayout /></ProtectedRoute>
            }>
              <Route index element={<ProfilePage />} />
            </Route>
            <Route path="/settings" element={
              <ProtectedRoute><AppLayout /></ProtectedRoute>
            }>
              <Route index element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
