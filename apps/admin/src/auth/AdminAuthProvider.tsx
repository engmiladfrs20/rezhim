import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@nutriai/types';
import type { LoginDto } from '@nutriai/schemas';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface AdminAuthContextType {
  user: PublicUser | null;
  isLoading: boolean;
  login: (data: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-auth', 'me'],
    queryFn: async () => {
      const resp = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' });
      if (!resp.ok) return null;
      const data = await resp.json();
      const loadedUser = data.data?.user;
      if (loadedUser && loadedUser.role !== 'admin') {
        // Log out non-admin accounts accessing the admin portal
        await fetch(`${API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
        return null;
      }
      return loadedUser || null;
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginDto) => {
      const resp = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || 'Login failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-auth', 'me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    },
    onSettled: () => {
      queryClient.setQueryData(['admin-auth', 'me'], null);
      queryClient.clear();
    },
  });

  return (
    <AdminAuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        login: async (d) => {
          await loginMutation.mutateAsync(d);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
