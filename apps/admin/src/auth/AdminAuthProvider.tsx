import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, PublicUser } from '@nutriai/types';
import type { LoginDto } from '@nutriai/schemas';

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://nutriai-api-production.rezhimvip.workers.dev');

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
        let message = 'Login failed';
        try {
          const err = (await resp.json()) as { error?: { message?: string } };
          message = err.error?.message || message;
        } catch {
          // Keep a useful UI error when a proxy returns a non-JSON response.
        }
        throw new Error(message);
      }
      const login = (await resp.json()) as ApiResponse<{ user: PublicUser }>;
      const loggedInUser = login.data?.user;
      if (!loggedInUser || loggedInUser.role !== 'admin') {
        throw new Error('This account is not authorized for the admin portal.');
      }

      // Verify that the browser accepted the cross-site session cookie. This
      // turns cookie/CORS misconfiguration into a visible login error instead
      // of silently returning to the login screen.
      const sessionResp = await fetch(`${API_URL}/api/v1/auth/me`, {
        credentials: 'include',
      });
      if (!sessionResp.ok) {
        throw new Error('Login succeeded, but the session cookie was not accepted. Please retry.');
      }
      const session = (await sessionResp.json()) as ApiResponse<{ user: PublicUser }>;
      if (session.data?.user?.role !== 'admin') {
        throw new Error('This account is not authorized for the admin portal.');
      }
      return session.data.user;
    },
    onSuccess: (loggedInUser) => {
      queryClient.setQueryData(['admin-auth', 'me'], loggedInUser);
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
