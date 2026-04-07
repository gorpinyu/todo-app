import * as http from "http";
import { handleRequest } from "./routes.js";
import { handleAuth, handlePasswordReset, verifyToken } from "./auth.js";
import { initDb } from "./db.js";

let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready) ready = initDb().catch((e) => { ready = null; throw e; });
  return ready;
}

const AUTH_BYPASS = ["/api/auth/register", "/api/auth/login", "/api/auth/forgot-password", "/api/auth/reset-password"];

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}

async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  await ensureReady();

  // One-time migration endpoint
  if (url.pathname === "/api/migrate" && req.method === "POST") {
    const { query } = await import("./db.js");
    await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE`);
    await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
    await query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }

  if (AUTH_BYPASS.includes(url.pathname)) {
    const res = (await handleAuth(req)) ?? (await handlePasswordReset(req));
    return res ?? new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
  }

  const user = verifyToken(req.headers.get("authorization") ?? undefined);
  if (!user) return unauthorized();

  console.log(`[AUTH] Request to ${url.pathname} by user_id=${user.user_id}, email=${user.email}`);
  
  return handleRequest(req, user);
}

// Lambda handler
export async function handler(event: any, _context: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.requestContext?.http?.path ?? event.path ?? "/";
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const bodyStr = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString()
    : (event.body ?? "");

  const req = new Request(`https://lambda${path}${qs}`, {
    method,
    headers: event.headers ?? {},
    body: ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : bodyStr,
  });

  const res = await dispatch(req);
  return { statusCode: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.text() };
}

// Local dev server
if (process.env.NODE_ENV !== "production") {
  const PORT = parseInt(process.env.PORT ?? "3001");
  ensureReady().then(() => {
    http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const body = Buffer.concat(chunks).toString();
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "") ? undefined : body,
        });
        const response = await dispatch(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(await response.text());
      });
    }).listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
  });
}
