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

export function verifyToken(authHeader: string | undefined): { user_id: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { user_id: number; email: string };
  } catch {
    return null;
  }
}
