import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { query, seedUserTasks, ensureDefaultProject } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";
const JWT_EXPIRES = "7d";

function token(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export async function handleAuth(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (path === "/api/auth/register" && method === "POST") {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    const { rows: existing } = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.length > 0) return json({ error: "Email already registered" }, 409);

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, password_hash],
    );
    const user = rows[0];
    await ensureDefaultProject(user.id);
    await seedUserTasks(user.id);
    return json({ token: token({ user_id: user.id, email: user.email }), user: { id: user.id, email: user.email } }, 201);
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return json({ error: "Email and password required" }, 400);

    const { rows } = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    if (rows.length === 0) return json({ error: "Invalid credentials" }, 401);

    const user = rows[0];
    // Google-only accounts have no password_hash — bcrypt.compare needs a
    // string hash, so this must be checked before calling it, not left to
    // whatever bcryptjs does with null.
    if (!user.password_hash) return json({ error: "Invalid credentials" }, 401);
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return json({ error: "Invalid credentials" }, 401);

    await ensureDefaultProject(user.id);
    await seedUserTasks(user.id);
    return json({ token: token({ user_id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
  }

  return null; // not an auth route
}

const APP_URL = process.env.APP_URL ?? "https://gorpyniuk.com";
const GMAIL_USER = process.env.GMAIL_USER ?? "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? "";

const mailer = GMAIL_USER && GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

// Fire-and-forget, same as the original Lambda InvocationType "Event" call — the caller
// doesn't wait on this. Errors are caught here (not left to reject silently) because this
// runs in a long-lived Node process, not a one-shot Lambda invocation: an uncaught rejection
// here would crash request handling for every user, not just the one whose email failed.
async function sendEmailAsync(to: string, subject: string, html: string, text: string) {
  if (!mailer) return;
  try {
    await mailer.sendMail({ from: GMAIL_USER, to, subject, html, text });
  } catch (err) {
    console.error("[email] failed to send:", err);
  }
}

export async function handlePasswordReset(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === "/api/auth/forgot-password" && method === "POST") {
    const { email } = await req.json();
    if (!email) return json({ error: "Email required" }, 400);

    const { rows } = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (rows.length === 0) return json({ message: "If that email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [rows[0].id, token, expires.toISOString()],
    );

    const resetUrl = `${APP_URL}?reset_token=${token}`;
    await sendEmailAsync(
      email,
      "Reset your TaskBoard password",
      `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
      `Reset your password: ${resetUrl}\n\nExpires in 1 hour. If you didn't request this, ignore this email.`,
    );

    return json({ message: "If that email exists, a reset link has been sent." });
  }

  if (path === "/api/auth/reset-password" && method === "POST") {
    const { token, password } = await req.json();
    if (!token || !password) return json({ error: "Token and password required" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    const { rows } = await query(
      "SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()",
      [token],
    );
    if (rows.length === 0) return json({ error: "Invalid or expired reset token" }, 400);

    const password_hash = await bcrypt.hash(password, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, rows[0].user_id]);
    await query("UPDATE password_reset_tokens SET used = TRUE WHERE id = $1", [rows[0].id]);

    return json({ message: "Password updated successfully" });
  }

  return null;
}

// --- Google OAuth: server-side authorization-code flow. Same trust model and
// account-linking behavior as hockey.gorpyniuk.com's implementation (see
// N8N_Server_Setup_with_Claude/03_Setup/SITES.md), adapted for this app's
// bearer-token-in-localStorage auth instead of an httpOnly session cookie:
// the callback hands the JWT back via a one-time `?google_token=` query
// param, the same bridge pattern this app already uses for password-reset
// links (`?reset_token=`) — the frontend reads it once and immediately
// strips it from the URL with history.replaceState.
//
// This uses its own Google Cloud project/OAuth client, separate from
// hockey's — GOOGLE_CLIENT_ID/SECRET below are TaskBoard-specific.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "oauth_state";
const STATE_COOKIE_MAX_AGE_SEC = 5 * 60;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

function googleRedirectUri(req: Request): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${new URL(req.url).origin}/api/auth/google/callback`;
}

function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function redirect(location: string, setCookie?: string): Response {
  const h: Record<string, string> = { Location: location };
  if (setCookie) h["Set-Cookie"] = setCookie;
  return new Response(null, { status: 302, headers: h });
}

const CLEAR_STATE_COOKIE = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;

export async function handleGoogleAuth(req: Request): Promise<Response | null> {
  const url = new URL(req.url);

  if (url.pathname === "/api/auth/google" && req.method === "GET") {
    const state = crypto.randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: googleRedirectUri(req),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return redirect(
      `${GOOGLE_AUTH_URL}?${params.toString()}`,
      `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_COOKIE_MAX_AGE_SEC}; Path=/`,
    );
  }

  if (url.pathname === "/api/auth/google/callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = parseCookie(req, STATE_COOKIE);

    if (!code || !state || !cookieState || state !== cookieState) {
      return redirect(`${APP_URL}?auth_error=google_state_mismatch`, CLEAR_STATE_COOKIE);
    }

    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: googleRedirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      const tokenBody: any = await tokenRes.json();
      if (!tokenRes.ok || !tokenBody.id_token) {
        console.error("Google token exchange failed:", tokenBody);
        return redirect(`${APP_URL}?auth_error=google_token_exchange`, CLEAR_STATE_COOKIE);
      }

      // Trusted without re-verifying the id_token's JWT signature: it came back
      // to THIS SERVER directly from Google's token endpoint over a
      // server-to-server HTTPS call authenticated with our own client secret —
      // never touched by the browser. Same reasoning as hockey's implementation.
      const payloadB64 = tokenBody.id_token.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      const { sub: googleSub, email, email_verified: emailVerified } = payload;
      if (!email || !emailVerified) {
        return redirect(`${APP_URL}?auth_error=google_email_unverified`, CLEAR_STATE_COOKIE);
      }
      const normalizedEmail = String(email).trim().toLowerCase();

      let user;
      let found = await query("SELECT id, email FROM users WHERE google_sub = $1", [googleSub]);
      user = found.rows[0];

      if (!user) {
        // Account-linking: an existing email/password user signing in with
        // Google for the first time gets google_sub attached to their
        // existing row instead of creating a duplicate account.
        found = await query("SELECT id, email FROM users WHERE email = $1", [normalizedEmail]);
        user = found.rows[0];
        if (user) {
          const updated = await query(
            "UPDATE users SET google_sub = $1 WHERE id = $2 RETURNING id, email",
            [googleSub, user.id],
          );
          user = updated.rows[0];
        } else {
          const created = await query(
            "INSERT INTO users (email, google_sub) VALUES ($1, $2) RETURNING id, email",
            [normalizedEmail, googleSub],
          );
          user = created.rows[0];
        }
      }

      await ensureDefaultProject(user.id);
      await seedUserTasks(user.id);

      const authToken = token({ user_id: user.id, email: user.email });
      return redirect(`${APP_URL}?google_token=${authToken}`, CLEAR_STATE_COOKIE);
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      return redirect(`${APP_URL}?auth_error=google_unexpected`, CLEAR_STATE_COOKIE);
    }
  }

  return null;
}

export function verifyToken(authHeader: string | undefined): { user_id: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { user_id: number; email: string };
  } catch {
    return null;
  }
}
