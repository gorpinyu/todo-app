import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, seedUserTasks } from "./db.js";

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

    await seedUserTasks(user.id);
    return json({ token: token({ user_id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
  }

  return null; // not an auth route
}

export function verifyToken(authHeader: string | undefined): { user_id: number; email: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as { user_id: number; email: string };
  } catch {
    return null;
  }
}
