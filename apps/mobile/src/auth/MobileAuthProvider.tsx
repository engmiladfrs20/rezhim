import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import type { PublicUser } from '@nutriai/types';
import type { LoginDto } from '@nutriai/schemas';
import { MobileAuthApi } from './api';

export interface MobileAuthContextType {
  user: PublicUser | null;
  isLoading: boolean;
  login: (data: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { display_name?: string; locale?: 'fa' | 'en' }) => Promise<PublicUser>;
  changePassword: (data: { current_password: string; new_password: string }) => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

export const TOKEN_KEY = 'nutriai_mobile_token';

export const MobileAuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const val = await SecureStore.getItemAsync(TOKEN_KEY);
        setToken(val);
      } catch {
        setToken(null);
      } finally {
        setIsInitializing(false);
      }
    }
    initAuth();
  }, []);

  const { data: user, isLoading: queryLoading } = useQuery<PublicUser | null>({
    queryKey: ['mobile-auth', 'me', token],
    queryFn: async () => {
      if (!token) return null;
      try {
        const me = await MobileAuthApi.getMe(token);
        return me;
      } catch {
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        } finally {
          setToken(null);
        }
        return null;
      }
    },
    enabled: !!token,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginDto) => {
      const { token: rawToken } = await MobileAuthApi.loginToken(credentials);
      await SecureStore.setItemAsync(TOKEN_KEY, rawToken);
      setToken(rawToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-auth', 'me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        if (token) {
          await MobileAuthApi.logout(token);
        }
      } finally {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
      }
    },
    onSettled: () => {
      queryClient.setQueryData(['mobile-auth', 'me', token], null);
      queryClient.clear();
    },
  });

  const updateProfile = async (data: {
    display_name?: string;
    locale?: 'fa' | 'en';
  }): Promise<PublicUser> => {
    if (!token) throw new Error('Not authenticated');
    const updated = await MobileAuthApi.updateProfile(token, data);
    queryClient.invalidateQueries({ queryKey: ['mobile-auth', 'me'] });
    return updated;
  };

  const changePassword = async (data: {
    current_password: string;
    new_password: string;
  }): Promise<void> => {
    if (!token) throw new Error('Not authenticated');
    await MobileAuthApi.changePassword(token, data);
  };

  return (
    <MobileAuthContext.Provider
      value={{
        user: user || null,
        isLoading: isInitializing || (!!token && queryLoading),
        login: async (d) => {
          await loginMutation.mutateAsync(d);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </MobileAuthContext.Provider>
  );
};

export const useMobileAuth = () => {
  const context = useContext(MobileAuthContext);
  if (context === undefined) {
    throw new Error('useMobileAuth must be used within a MobileAuthProvider');
  }
  return context;
};
