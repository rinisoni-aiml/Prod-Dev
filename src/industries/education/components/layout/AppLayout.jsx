import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, Briefcase, GraduationCap, Upload, PanelLeftClose, PanelLeft, Clock } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AIChatDrawer from '@/industries/education/components/chat/AIChatDrawer';
import AIChatFAB from '@/industries/education/components/chat/AIChatFAB';

const navItems = [
  { label: 'Executive Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Academic Intelligence', path: '/dashboard/academic', icon: BookOpen },
  { label: 'Admissions & Revenue', path: '/dashboard/admissions', icon: Users },
  { label: 'Faculty & Staff', path: '/dashboard/faculty', icon: Briefcase },
  { label: 'Placements', path: '/dashboard/placements', icon: GraduationCap },
  { label: 'Data Upload', path: '/dashboard/data', icon: Upload },
];

const AppLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const lastUpdated = new Date();
  const timeAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);

  return (
    <div className="min-h-screen bg-background flex">

      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 border-r border-border bg-background-surface transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
        <div className={`h-16 flex items-center border-b border-border px-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed && <Logo size="sm" />}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-foreground-secondary hover:text-foreground"
          >
            {sidebarCollapsed
              ? <PanelLeft className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/dashboard'}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'gradient-brand !text-white shadow-sm'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-muted'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>

        {/* Header */}
        <header className="sticky top-0 z-30 h-14 glass-card border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="md:hidden"><Logo size="sm" /></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-foreground-secondary" />
              <span className="text-foreground-secondary">
                Last updated {timeAgo < 1 ? 'just now' : `${timeAgo} min ago`}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-card border-t">
        <div className="flex items-center justify-around h-14">
          {navItems.slice(0, 5).map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/dashboard'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-foreground-secondary'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label.split(' ')[0]}
            </NavLink>
          ))}
        </div>
      </nav>

      <AIChatFAB />
      <AIChatDrawer />
    </div>
  );
};

export default AppLayout;