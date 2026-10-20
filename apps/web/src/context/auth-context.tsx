'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, type User, type Workspace } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  apiConnected: boolean;
  dbConnected: boolean;
  redisConnected: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    workspaceName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
  quickDemoLogin: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
  initialToken?: string | null | undefined;
  initialUser?: User | null | undefined;
  initialWorkspace?: Workspace | null | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialToken = null,
  initialUser = null,
  initialWorkspace = null,
}: AuthProviderProps) {
  const isMountedRef = useRef(true);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    initialWorkspace ? [initialWorkspace] : [],
  );
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    initialWorkspace ?? null,
  );
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [redisConnected, setRedisConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!initialToken && !initialUser);

  // Probe backend readiness on mount
  const checkHealth = useCallback(async () => {
    try {
      const ready = await api.getReadiness();
      if (!isMountedRef.current || typeof window === 'undefined') return;
      setApiConnected(true);
      setDbConnected(ready.checks.database.status === 'up');
      setRedisConnected(ready.checks.redis.status === 'up');
    } catch {
      if (!isMountedRef.current || typeof window === 'undefined') return;
      setApiConnected(false);
      setDbConnected(false);
      setRedisConnected(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const list = await api.getWorkspaces();
      if (!isMountedRef.current || typeof window === 'undefined') return;
      setWorkspaces(list);
      if (list.length > 0) {
        setCurrentWorkspace((prev) => {
          if (prev && list.some((w) => w.id === prev.id)) {
            return prev;
          }
          return list[0] ?? null;
        });
      }
    } catch {
      // Ignored if unauthorized
    }
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    isMountedRef.current = true;
    if (initialToken || initialUser) {
      setIsLoading(false);
      void checkHealth();
      return () => {
        isMountedRef.current = false;
      };
    }

    const savedToken = api.getToken();
    if (savedToken) {
      setToken(savedToken);
      // Attempt to load workspaces with existing token
      refreshWorkspaces().finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }

    void checkHealth();
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        void checkHealth();
      }
    }, 15000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [checkHealth, refreshWorkspaces, initialToken, initialUser]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      setToken(res.sessionToken);
      await refreshWorkspaces();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    workspaceName?: string,
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.register(name, email, password, workspaceName);
      setUser(res.user);
      setToken(res.sessionToken);
      await refreshWorkspaces();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch {
      // Cleanup locally anyway
    }
    setUser(null);
    setToken(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
  };

  const switchWorkspace = (workspaceId: string): void => {
    const found = workspaces.find((w) => w.id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
    }
  };

  const createWorkspace = async (name: string): Promise<Workspace> => {
    const res = await api.createWorkspace(name);
    await refreshWorkspaces();
    setCurrentWorkspace(res.workspace);
    return res.workspace;
  };

  /**
   * One-click demo onboarding for rapid testing and evaluation.
   */
  const quickDemoLogin = async (): Promise<void> => {
    setIsLoading(true);
    const demoEmail = `merchant_${Date.now()}@commercepilot.demo`;
    const demoPass = 'DemoPassword123!';
    try {
      const reg = await api.register('Commerce Merchant', demoEmail, demoPass);
      setUser(reg.user);
      setToken(reg.sessionToken);

      const wsRes = await api.createWorkspace('Demo Fashion Flagship', `demo-store-${Date.now()}`);
      setWorkspaces([wsRes.workspace]);
      setCurrentWorkspace(wsRes.workspace);
    } catch {
      // If registration fails (e.g. offline), create mock workspace for UI preview
      const fallbackWs: Workspace = {
        id: '60b8d29f1c9d440000a11111',
        name: 'Demo Fashion Flagship',
        slug: 'demo-fashion-flagship',
      };
      setWorkspaces([fallbackWs]);
      setCurrentWorkspace(fallbackWs);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workspaces,
        currentWorkspace,
        apiConnected,
        dbConnected,
        redisConnected,
        isLoading,
        login,
        register,
        logout,
        switchWorkspace,
        createWorkspace,
        quickDemoLogin,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
