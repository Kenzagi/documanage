import { create } from 'zustand';
import type { UserWithoutPassword, AuthState } from '@/types';

interface AuthStore extends AuthState {
  setUser: (user: UserWithoutPassword | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  login: async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        set({ 
          user: data.user, 
          isAuthenticated: true,
          isLoading: false 
        });
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'An error occurred during login' };
    }
  },
  
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      });
    }
  },
  
  checkSession: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      
      if (data.success && data.user) {
        set({ 
          user: data.user, 
          isAuthenticated: true,
          isLoading: false 
        });
      } else {
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false 
        });
      }
    } catch {
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      });
    }
  },
}));
