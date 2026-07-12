import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { LoginSignup } from './pages/LoginSignup';
import { ProtectedRoute } from './components/ProtectedRoute';
import { api } from './lib/api';

import { Dashboard } from './pages/Dashboard';
import { OrgSetup } from './pages/OrgSetup';
import { AssetDirectory } from './pages/AssetDirectory';
import { Allocations } from './pages/Allocations';
import { Bookings } from './pages/Bookings';
import { Maintenance } from './pages/Maintenance';
import { Audits } from './pages/Audits';
import { Reports } from './pages/Reports';
import { ActivityLogs } from './pages/ActivityLogs';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/dismiss-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen session-shell flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-primary-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        <p className="text-slate-600 text-sm font-medium tracking-wide">Initializing secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !employee) {
    return <LoginSignup onSuccess={checkAuth} />;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'org-setup', label: 'Org setup', icon: Building2, roles: ['ADMIN'] },
    { id: 'assets', label: 'Asset directory', icon: Box, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'allocations', label: 'Allocations', icon: Shuffle, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'audits', label: 'Audits', icon: ClipboardCheck, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'] },
    { id: 'reports', label: 'Reports & analytics', icon: BarChart3, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'] },
    { id: 'logs', label: 'Activity logs', icon: FileText, roles: ['ADMIN'] },
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
    <div className="h-screen app-shell flex flex-col overflow-hidden">
      <header className="sticky top-0 h-20 bg-white border-b border-slate-200 flex-shrink-0 flex items-center justify-between px-4 sm:px-8 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-10 h-10 rounded-lg border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 transition flex items-center justify-center"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-500 text-white flex items-center justify-center shadow-sm shadow-primary-500/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 truncate">AssetFlow</h1>
          </div>
        </div>

        <span className="absolute left-1/2 -translate-x-1/2 text-[12px] font-semibold uppercase tracking-[0.34em] text-slate-500 hidden sm:block">
          Workspace
        </span>

        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative w-12 h-12 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition flex items-center justify-center"
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 text-[10px] font-bold text-white bg-primary-500 rounded-full leading-5 text-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-950">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dismissAllMutation.mutate()}
                    disabled={dismissAllMutation.isPending}
                    className="text-[10px] text-primary-700 hover:text-primary-600 font-semibold cursor-pointer outline-none"
                  >
                    Dismiss All
                  </button>
                )}
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-200">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No notifications to display.
                  </div>
                ) : (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors flex justify-between items-start gap-2 ${
                        n.isRead ? 'opacity-70 bg-white' : 'bg-primary-50/70 hover:bg-primary-50'
                      }`}
                    >
                      <div className="space-y-1 pr-2">
                        <p className="text-slate-700 leading-snug">{n.message}</p>
                        <span className="text-[9px] text-slate-500 block">
                          {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          disabled={markReadMutation.isPending}
                          className="text-[9px] font-bold text-teal-700 hover:underline cursor-pointer flex-shrink-0 outline-none"
                        >
                          Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-x-0 bottom-0 top-20 bg-slate-900/20 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed top-20 bottom-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col justify-between ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:relative lg:top-0 lg:bottom-auto lg:h-full lg:translate-x-0 lg:flex-shrink-0`}
        >
          <nav className="p-3 sm:p-4 space-y-2 overflow-y-auto">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentScreen(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[15px] font-semibold transition-all outline-none border-l-4 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-primary-500 shadow-sm'
                      : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-950 hover:border-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200 space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-extrabold">
                {employee.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-950 truncate">{employee.name}</p>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 inline-block mt-0.5">
                  {employee.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button
              onClick={() => clearSession()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 hover:text-red-600 text-slate-600 text-xs font-bold tracking-wider uppercase rounded-lg transition outline-none cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-5 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          <div className="max-w-6xl mx-auto">
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
