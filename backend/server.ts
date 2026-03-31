import * as http from "http";
import { handleRequest } from "./routes";
import { initDb } from "./db";

// Initialise DB schema + seed once — lazily on first request
let ready: Promise<void> | null = null;
function ensureReady() {
  if (!ready) ready = initDb();
  return ready;
}

// Lambda handler
export async function handler(event: any, context: any) {
  await ensureReady();

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

  const res = await handleRequest(req);
  const resBody = await res.text();

  return {
    statusCode: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: resBody,
  };
}

// Local dev server (bun or node)
if (process.env.NODE_ENV !== "production") {
  const PORT = parseInt(process.env.PORT ?? "3001");

  ensureReady().then(() => {
    http.createServer(async (req, res) => {
      const url = `http://localhost${req.url}`;
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        const body = Buffer.concat(chunks).toString();
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: ["GET", "HEAD", "OPTIONS"].includes(req.method ?? "") ? undefined : body,
        });
        const response = await handleRequest(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(await response.text());
      });
    }).listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
  });
}
