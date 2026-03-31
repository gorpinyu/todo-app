import * as http from "http";
import { handleRequest } from "./routes.js";
import { handleAuth, verifyToken } from "./auth.js";
import { initDb } from "./db.js";

let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready) ready = initDb();
  return ready;
}

const AUTH_BYPASS = ["/api/auth/register", "/api/auth/login"];

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

  if (AUTH_BYPASS.includes(url.pathname)) {
    const res = await handleAuth(req);
    return res ?? new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
  }

  const user = verifyToken(req.headers.get("authorization") ?? undefined);
  if (!user) return unauthorized();

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
