import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Settings, User, LayoutDashboard, TrendingUp, Package, FileText, Upload, PanelLeftClose, PanelLeft, Clock, AlertTriangle, Truck, ShieldCheck, BarChart2, Building2, Bot } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import AIChatDrawer from '@/components/chat/AIChatDrawer';
import AIChatFAB from '@/components/chat/AIChatFAB';

const fmcgNavItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Forecasting', path: '/dashboard/forecasting', icon: TrendingUp },
  { label: 'Inventory', path: '/dashboard/inventory', icon: Package },
  { label: 'Contracts & Alerts', path: '/dashboard/contracts', icon: FileText },
  { label: 'Data Upload', path: '/dashboard/data', icon: Upload },
];

const logisticsNavItems = [
  { label: 'Dashboard',       path: '/dashboard/logistics',                   icon: LayoutDashboard },
  { label: 'Alert Center',    path: '/dashboard/logistics/alerts',            icon: AlertTriangle },
  { label: 'Shipment Risk',   path: '/dashboard/logistics/shipment-risk',     icon: Truck },
  { label: 'Compliance',      path: '/dashboard/logistics/compliance',        icon: ShieldCheck },
  { label: 'Risk Analytics',  path: '/dashboard/logistics/risk-analytics',    icon: BarChart2 },
  { label: 'Vendor Intel',    path: '/dashboard/logistics/vendor-intel',      icon: Building2 },
  { label: 'AI Assistant',    path: '/dashboard/logistics/ai-assistant',      icon: Bot },
  { label: 'Data Upload',     path: '/dashboard/logistics/data',              icon: Upload },
];

const navItemsByIndustry = {
  fmcg: fmcgNavItems,
  logistics: logisticsNavItems,
};

const AppLayout = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const navItems = navItemsByIndustry[profile?.industry] || fmcgNavItems;

  const handleLogout = async () => { await logout(); navigate('/'); };
  const lastUpdated = new Date();
  const timeAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 border-r border-border bg-background-surface transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        <div className={`h-16 flex items-center border-b border-border px-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed && <Logo size="sm" />}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground-secondary hover:text-foreground">
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/dashboard'} title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? 'gradient-brand !text-white shadow-sm' : 'text-foreground-secondary hover:text-foreground hover:bg-muted'} ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <Icon className="h-4 w-4 flex-shrink-0" />{!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        {!sidebarCollapsed && (<div className="p-3 border-t border-border"><div className="flex items-center gap-3 px-2 py-2"><div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">{profile?.full_name?.[0] || 'U'}</div><div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'User'}</p><p className="text-xs text-foreground-secondary truncate">{profile?.company_name || 'Company'}</p></div></div></div>)}
      </aside>
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        <header className="sticky top-0 z-30 h-14 glass-card border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-3"><div className="md:hidden"><Logo size="sm" /></div></div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5 text-foreground-secondary" /><span className="text-foreground-secondary">Last updated {timeAgo < 1 ? 'just now' : `${timeAgo} min ago`}</span></div>
            <ThemeToggle />
            <button className="relative h-9 w-9 rounded-lg border border-border bg-background-surface flex items-center justify-center hover-lift"><Bell className="h-4 w-4 text-foreground-secondary" /><span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">3</span></button>
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-background-surface hover-lift">
                <div className="h-6 w-6 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold">{profile?.full_name?.[0] || 'U'}</div>
                <ChevronDown className="h-3 w-3 text-foreground-secondary" />
              </button>
              {userMenuOpen && (<><div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} /><div className="absolute right-0 top-12 w-48 glass-card rounded-xl border shadow-lg p-2 z-50"><div className="px-3 py-2 border-b border-border mb-1"><p className="text-sm font-medium text-foreground">{profile?.full_name || 'User'}</p><p className="text-xs text-foreground-secondary">{profile?.company_name || 'Company'}</p></div><button onClick={() => { navigate('/profile'); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-muted rounded-lg"><User className="h-4 w-4" /> Profile</button><button onClick={() => { navigate('/settings'); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-muted rounded-lg"><Settings className="h-4 w-4" /> Settings</button><button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg"><LogOut className="h-4 w-4" /> Logout</button></div></>)}
            </div>
          </div>
        </header>
        <main className="flex-1 pb-16 md:pb-0"><Outlet /></main>
      </div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-card border-t"><div className="flex items-center justify-around h-14">{navItems.slice(0, 4).map(({ label, path, icon: Icon }) => (<NavLink key={path} to={path} end={path === '/dashboard'} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-foreground-secondary'}`}><Icon className="h-4 w-4" />{label.split(' ')[0]}</NavLink>))}</div></nav>
      <AIChatFAB /><AIChatDrawer />
    </div>
  );
};
export default AppLayout;
