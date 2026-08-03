import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

type ErrorType = "wrong_password" | "not_found" | "other" | null;

function classifyError(msg: string): ErrorType {
  const m = msg.toLowerCase();
  if (m.includes("invalid credentials")) return "wrong_password";
  return "other";
}

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_state_mismatch: "Google sign-in expired or was tampered with — please try again.",
  google_token_exchange: "Google sign-in failed — please try again.",
  google_email_unverified: "That Google account's email isn't verified — please use a different sign-in method.",
  google_unexpected: "Something went wrong signing in with Google — please try again.",
};

export default function LoginPage({ onSwitch, onForgotPassword }: { onSwitch: () => void; onForgotPassword: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setError(GOOGLE_ERROR_MESSAGES[authError] ?? "Sign-in failed — please try again.");
      setErrorType("other");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setErrorType(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = err.message ?? "Login failed";
      setError(msg);
      setErrorType(classifyError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <span className="auth-logo-text">Task<span>Board</span></span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              <div>{error}</div>
              <div className="auth-error-actions">
                {errorType === "wrong_password" && (
                  <>
                    <span>Wrong password? </span>
                    <button type="button" className="auth-link" onClick={onForgotPassword}>Reset it</button>
                    <span> or check your email is correct — </span>
                    <button type="button" className="auth-link" onClick={onSwitch}>create a new account</button>
                  </>
                )}
                {errorType === "other" && (
                  <>
                    <button type="button" className="auth-link" onClick={onForgotPassword}>Reset password</button>
                    <span> · </span>
                    <button type="button" className="auth-link" onClick={onSwitch}>Create account</button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Email address</label>
            <input type="email" className="form-control" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="auth-forgot">
            <button type="button" className="auth-link" onClick={onForgotPassword}>Forgot password?</button>
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <button type="button" className="btn btn-secondary auth-submit" style={{ width: "100%" }}
          onClick={() => { window.location.href = "/api/auth/google"; }}>
          Continue with Google
        </button>
        <p className="auth-switch">
          Don't have an account?{" "}
          <button onClick={onSwitch} className="auth-link">Create one</button>
        </p>
      </div>
    </div>
  );
}
