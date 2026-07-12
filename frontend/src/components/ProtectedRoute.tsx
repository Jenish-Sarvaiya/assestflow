import React from 'react';
import { useAuthStore } from '../store/auth';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE')[];
  fallbackRedirect?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallbackRedirect
}) => {
  const { isAuthenticated, employee, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen session-shell flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-primary-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium tracking-wide">Loading secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !employee) {
    // If we have a fallback, execute it or let the parent layout handle redirect (we will check auth in App.tsx)
    if (fallbackRedirect) {
      fallbackRedirect();
    }
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(employee.role)) {
    return (
      <div className="min-h-screen session-shell flex flex-col items-center justify-center p-6">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center space-y-6 relative overflow-hidden border border-red-500/10">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500"></div>
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Access Denied</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Your role (<span className="text-red-400 font-semibold">{employee.role}</span>) does not have permission to access this resource.
          </p>
          <div className="pt-2">
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
export default ProtectedRoute;
