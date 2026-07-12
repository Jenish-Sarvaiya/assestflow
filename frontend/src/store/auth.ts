import { create } from 'zustand';
import { api } from '../lib/api';

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'ASSET_MANAGER' | 'DEPARTMENT_HEAD' | 'EMPLOYEE';
  departmentId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  department?: {
    id: number;
    name: string;
  } | null;
}

interface AuthState {
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (token: string, employee: Employee) => void;
  clearSession: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('assetflow_token'),
  employee: localStorage.getItem('assetflow_employee')
    ? JSON.parse(localStorage.getItem('assetflow_employee')!)
    : null,
  isAuthenticated: !!localStorage.getItem('assetflow_token'),
  isLoading: false,

  setSession: (token, employee) => {
    localStorage.setItem('assetflow_token', token);
    localStorage.setItem('assetflow_employee', JSON.stringify(employee));
    set({ token, employee, isAuthenticated: true });
  },

  clearSession: () => {
    localStorage.removeItem('assetflow_token');
    localStorage.removeItem('assetflow_employee');
    set({ token: null, employee: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('assetflow_token');
    if (!token) {
      set({ token: null, employee: null, isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const data = await api.get<{ employee: Employee }>('/auth/me');
      localStorage.setItem('assetflow_employee', JSON.stringify(data.employee));
      set({ employee: data.employee, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('CheckAuth profile refresh failed:', error);
      // If server session is invalid, clear token
      localStorage.removeItem('assetflow_token');
      localStorage.removeItem('assetflow_employee');
      set({ token: null, employee: null, isAuthenticated: false, isLoading: false });
    }
  }
}));
