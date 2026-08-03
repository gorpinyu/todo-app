import React, { createContext, useContext, useState, useEffect } from "react";

interface User { id: number; email: string; }

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = "/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Google sign-in redirects here with a one-time `?google_token=` — the
    // backend has no way to hand it to frontend JS directly (it's a full
    // page navigation through Google, not a fetch), so it's bridged through
    // the URL the same way password-reset links use `?reset_token=`. Read
    // once, strip immediately so it never lingers in history.
    const googleToken = new URLSearchParams(window.location.search).get("google_token");
    if (googleToken) {
      try {
        const payload = JSON.parse(atob(googleToken.split(".")[1]));
        persist(googleToken, { id: payload.user_id, email: payload.email });
      } finally {
        window.history.replaceState({}, "", window.location.pathname);
      }
      return;
    }

    const stored = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  function persist(t: string, u: User) {
    localStorage.setItem("auth_token", t);
    localStorage.setItem("auth_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => { throw new Error("Server unavailable — is the backend running?"); });
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    persist(data.token, data.user);
  }

  async function register(email: string, password: string) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => { throw new Error("Server unavailable — is the backend running?"); });
    if (!res.ok) throw new Error(data.error ?? "Registration failed");
    persist(data.token, data.user);
  }

  function logout() {
    localStorage.clear(); // Clear ALL localStorage including active_project_id
    setToken(null);
    setUser(null);
    window.location.reload(); // Force full page reload to clear all state
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
