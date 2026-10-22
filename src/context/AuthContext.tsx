import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { apiClient } from '../api/client.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name: string; timezone?: string }) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiClient
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        apiClient.clearToken();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.login({ email, password });
    apiClient.setToken(res.token);
    setUser(res.user);
  };

  const register = async (payload: { email: string; password: string; full_name: string; timezone?: string }) => {
    const res = await apiClient.register(payload);
    apiClient.setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    apiClient.clearToken();
    setUser(null);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
