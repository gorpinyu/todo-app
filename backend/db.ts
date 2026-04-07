import { Pool } from "pg";

let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432"),
    user: process.env.DB_USER ?? "todo_admin",
    password: process.env.DB_PASSWORD ?? "postgres",
    database: process.env.DB_NAME ?? "todo",
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_HOST?.includes("rds.amazonaws.com") ? { rejectUnauthorized: false } : false,
  });
  pool.on("error", () => { pool = null; });
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  const p = await getPool();
  return p.query(text, params);
}

export async function initDb(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    description TEXT,
    color       TEXT,
    emoji       TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    archived    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS priorities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority_id INTEGER REFERENCES priorities(id),
    category_id INTEGER REFERENCES categories(id),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    due_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`);

  // Migration: Add completed_at column if it doesn't exist
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`).catch(() => {});

  await query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`).catch(() => {});

  await query(`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await query("SELECT COUNT(*) as c FROM categories");
  if (parseInt(rows[0].c) > 0) return;

  // Seed categories and priorities (shared across all users)
  const cats = [["Work","💼"],["Personal","🏠"],["Health","💪"],["Learning","📚"],["Finance","💰"],["Shopping","🛒"]];
  for (const [name, emoji] of cats) {
    await query("INSERT INTO categories (name, emoji) VALUES ($1, $2)", [name, emoji]);
  }

  const prios = [["High","🔴"],["Medium","🟡"],["Low","🟢"]];
  for (const [name, emoji] of prios) {
    await query("INSERT INTO priorities (name, emoji) VALUES ($1, $2)", [name, emoji]);
  }
}

export async function ensureDefaultProject(userId: number): Promise<number> {
  const { rows } = await query(
    "SELECT id FROM projects WHERE user_id = $1 AND is_default = TRUE LIMIT 1",
    [userId],
  );
  if (rows.length > 0) return rows[0].id;
  const { rows: created } = await query(
    "INSERT INTO projects (user_id, name, is_default) VALUES ($1, 'Personal', TRUE) RETURNING id",
    [userId],
  );
  return created[0].id;
}

export async function seedUserTasks(userId: number): Promise<void> {
  const { rows } = await query("SELECT COUNT(*) as c FROM tasks WHERE user_id = $1", [userId]);
  if (parseInt(rows[0].c) > 0) return;

  const projectId = await ensureDefaultProject(userId);

  const tasks: [string, string, string, number, number, string][] = [
    ["Fix auth token refresh bug", "JWT tokens expire silently — add auto-refresh logic in the API client interceptor.", "todo", 1, 1, "2026-04-02"],
    ["Set up CI/CD pipeline", "Configure GitHub Actions for lint, test, and deploy to staging on every PR merge.", "inprogress", 1, 1, "2026-04-05"],
    ["Refactor database layer", "Replace raw SQL calls with a query builder. Eliminate duplication across 12 files.", "todo", 2, 1, "2026-04-10"],
    ["Bench press 100kg", "Progressive overload: 80→90→100kg over 6 weeks. Log every session in the notebook.", "inprogress", 2, 3, "2026-05-01"],
    ["Read The Pragmatic Programmer", "Finish chapters 6–10. Take notes on DRY and orthogonality. Apply one idea per week.", "todo", 3, 4, "2026-04-20"],
    ["Quarterly tax filing", "Gather all receipts, calculate deductions, submit via the online portal before deadline.", "todo", 1, 5, "2026-04-15"],
    ["Deploy v2.1 to production", "Run migration scripts, update env vars, monitor error rates for 30 min post-deploy.", "completed", 1, 1, "2026-03-28"],
    ["Upgrade Node.js to v22", "Test all services against v22 LTS. Update Dockerfile and CI matrix accordingly.", "inprogress", 2, 1, "2026-04-08"],
    ["5K run under 22 minutes", "Interval training 3x per week. Target race is April 26th. Current PB is 24:10.", "todo", 2, 3, "2026-04-26"],
    ["Write architecture decision record", "Document the move from REST to tRPC. Include trade-offs and the full migration path.", "completed", 2, 1, "2026-03-25"],
    ["Learn Rust ownership model", "Work through chapters 4–6 of The Rust Book. Build a small CLI tool as practice.", "todo", 3, 4, "2026-04-30"],
    ["Negotiate salary raise", "Prepare market data, list key achievements from last 6 months, schedule 1:1 with manager.", "todo", 1, 1, "2026-04-12"],
    ["Replace car brake pads", "Front pads worn to 2mm. Order OEM parts, block Saturday morning to do the job.", "inprogress", 1, 2, "2026-04-06"],
    ["Clear code review backlog", "8 open PRs waiting. Prioritise auth and payments modules. Aim to clear all by Friday.", "completed", 2, 1, "2026-03-29"],
    ["Set up home lab server", "Install Proxmox on the old ThinkPad. Spin up Gitea, Uptime Kuma, and a VPN endpoint.", "todo", 3, 2, "2026-05-10"],
  ];
  for (const [title, desc, status, prio, cat, due] of tasks) {
    await query(
      "INSERT INTO tasks (title, description, status, priority_id, category_id, user_id, project_id, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [title, desc, status, prio, cat, userId, projectId, due],
    );
  }

  const { rows: taskRows } = await query(
    "SELECT id FROM tasks WHERE user_id = $1 ORDER BY id ASC",
    [userId],
  );
  const ids = taskRows.map((r: any) => r.id);

  const commentSeeds: [number, string][] = [
    [ids[0], "Reproduced — happens after exactly 60 min idle. Axios interceptor looks like the fix point."],
    [ids[0], "PR drafted. Needs review from the backend team before merge."],
    [ids[1], "Lint and test steps green. Deploy step blocked on secrets config in repo settings."],
    [ids[3], "Hit 90kg x3 today. Shoulders held up. On track for 100kg by May."],
    [ids[6], "Migration ran clean. Zero errors in the first 30 min monitoring window."],
    [ids[9], "ADR reviewed and approved by the team. Merged into the docs repo."],
    [ids[12], "OEM parts ordered from the dealer. Arriving Friday. Job booked for Saturday 9am."],
    [ids[13], "6 of 8 PRs merged. Two need more discussion — flagged in Slack."],
  ];
  for (const [taskId, content] of commentSeeds) {
    if (taskId) await query("INSERT INTO comments (task_id, content) VALUES ($1, $2)", [taskId, content]);
  }
}
