import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Me, Role } from '@kirimin/shared';
import { api } from '../api/client';
import { getToken, removeToken, saveToken } from './storage';

interface AuthContextType {
  user: Me | null;
  token: string | null;
  activeRole: Role;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (payload: { name: string; phone: string; password: string; email?: string; role?: Role }) => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const storedToken = await getToken();
        if (storedToken) {
          setToken(storedToken);
          const me = await api.get<Me>('/me');
          if (mounted) {
            setUser(me);
          }
        }
      } catch (err) {
        console.warn('Init auth failed:', err);
        await removeToken();
        if (mounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await api.post<{ token: string; user: Me }>('/auth/login', {
      phone,
      password,
    });
    await saveToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (payload: {
    name: string;
    phone: string;
    password: string;
    email?: string;
    role?: Role;
  }) => {
    const res = await api.post<{ token: string; user: Me }>('/auth/register', payload);
    await saveToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const switchRole = async (role: Role) => {
    const updated = await api.patch<Me>('/me', { activeRole: role });
    setUser(updated);
  };

  const refreshMe = async () => {
    try {
      const me = await api.get<Me>('/me');
      setUser(me);
    } catch (err) {
      console.warn('Failed to refresh user:', err);
    }
  };

  const logout = async () => {
    await removeToken();
    setToken(null);
    setUser(null);
  };

  const activeRole: Role = user?.activeRole || 'sender';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeRole,
        isLoading,
        login,
        register,
        switchRole,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

