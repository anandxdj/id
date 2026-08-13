'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { tokenStore } from '@/lib/token-store';
import { AuthApi } from '@/features/auth/services/authApi';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  /** Adopt a session from a bridged access token (social-login /callback). */
  setSession: (accessToken: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const { accessToken } = await AuthApi.refresh();
        tokenStore.set(accessToken);
        const me = await AuthApi.me();
        setUser(me);
      } catch {
        tokenStore.set(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    return tokenStore.subscribe((token) => {
      if (token === null) setUser(null);
    });
  }, []);

  async function login(email: string, password: string) {
    const { user: u, accessToken } = await AuthApi.login(email, password);
    tokenStore.set(accessToken);
    setUser(u);
    return u;
  }

  async function register(name: string, email: string, password: string) {
    await AuthApi.register(name, email, password);
  }

  async function setSession(accessToken: string) {
    tokenStore.set(accessToken);
    const me = await AuthApi.me();
    setUser(me);
    return me;
  }

  async function logout() {
    try {
      await AuthApi.logout();
    } catch {
      // ignore — clear local state regardless
    }
    tokenStore.set(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
