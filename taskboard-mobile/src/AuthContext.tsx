import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";

interface User { id: number; email: string; }
interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync("auth_token");
      const u = await SecureStore.getItemAsync("auth_user");
      if (t && u) { setToken(t); setUser(JSON.parse(u)); }
      setLoading(false);
    })();
  }, []);

  async function persist(t: string, u: User) {
    await SecureStore.setItemAsync("auth_token", t);
    await SecureStore.setItemAsync("auth_user", JSON.stringify(u));
    setToken(t); setUser(u);
  }

  async function login(email: string, password: string) {
    const data = await api.login(email, password);
    await persist(data.token, data.user);
  }

  async function register(email: string, password: string) {
    const data = await api.register(email, password);
    await persist(data.token, data.user);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("auth_user");
    setToken(null); setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
