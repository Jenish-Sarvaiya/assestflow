import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { LoginSignup } from './pages/LoginSignup';
import { ProtectedRoute } from './components/ProtectedRoute';

// Import Screens
import { Dashboard } from './pages/Dashboard';
import { OrgSetup } from './pages/OrgSetup';
import { AssetDirectory } from './pages/AssetDirectory';
import { Allocations } from './pages/Allocations';
import { Bookings } from './pages/Bookings';
import { Maintenance } from './pages/Maintenance';
import { Audits } from './pages/Audits';
import { Reports } from './pages/Reports';
import { ActivityLogs } from './pages/ActivityLogs';

// Lucide Icons
import {
  LayoutDashboard,
  Building2,
  Box,
  Shuffle,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  FileText,
  LogOut,
  User as UserIcon,
  Bell,
  Menu,
  X
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { isAuthenticated, employee, isLoading, checkAuth, clearSession } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Restore session
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-primary-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium tracking-wide">Initializing secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !employee) {
    return <LoginSignup onSuccess={checkAuth} />;
  }

  // Sidebar navigation menu definition based on role permissions
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'org-setup', label: 'Org Setup', icon: Building2, roles: ['ADMIN'] },
    { id: 'assets', label: 'Asset Directory', icon: Box, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'allocations', label: 'Allocations', icon: Shuffle, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'audits', label: 'Audits', icon: ClipboardCheck, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] }, // Employees can view/act if assigned as auditors
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
    { id: 'logs', label: 'Activity Logs', icon: FileText, roles: ['ADMIN'] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(employee.role));

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'org-setup':
        return (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <OrgSetup />
          </ProtectedRoute>
        );
      case 'assets':
        return <AssetDirectory />;
      case 'allocations':
        return <Allocations />;
      case 'bookings':
        return <Bookings />;
      case 'maintenance':
        return <Maintenance />;
      case 'audits':
        return <Audits />;
      case 'reports':
        return (
          <ProtectedRoute allowedRoles={['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']}>
            <Reports />
          </ProtectedRoute>
        );
      case 'logs':
        return (
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <ActivityLogs />
          </ProtectedRoute>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] flex">
      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800/80 transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        <div>
          {/* Sidebar Brand header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
            <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              AssetFlow
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white transition outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentScreen(item.id);
                    // Close sidebar on mobile
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all outline-none ${
                    isActive
                      ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile footer info */}
        <div className="p-4 border-t border-slate-800/80 space-y-4">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center font-bold">
              {employee.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{employee.name}</p>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/40 inline-block mt-0.5">
                {employee.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={() => clearSession()}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-red-500/15 border border-slate-700/60 hover:border-red-500/25 hover:text-red-400 text-slate-400 text-xs font-bold tracking-wider uppercase rounded-xl transition outline-none cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-16 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between px-6 sticky top-0 backdrop-blur-md z-30">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white transition outline-none lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-slate-500 text-xs font-medium uppercase tracking-widest hidden sm:inline-block">
              WORKSPACE
            </span>
          </div>

          {/* Quick Access panel (Notifications and profile overview) */}
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-slate-400 hover:text-white transition outline-none cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
            </button>
          </div>
        </header>

        {/* Dynamic page contents */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderActiveScreen()}
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
