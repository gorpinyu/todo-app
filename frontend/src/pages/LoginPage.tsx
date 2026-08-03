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
        <button type="button" className="btn-google" style={{ width: "100%" }}
          onClick={() => { window.location.href = "/api/auth/google"; }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>
        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span>or sign in with email</span>
          <div className="auth-divider-line" />
        </div>
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
        <p className="auth-switch">
          Don't have an account?{" "}
          <button onClick={onSwitch} className="auth-link">Create one</button>
        </p>
      </div>
    </div>
  );
}
