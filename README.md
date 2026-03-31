# TaskBoard - To-Do App

A full-stack Kanban task manager with React + Node.js/Bun backend + SQLite.

## Quick Start

### Option A — With Bun (recommended, as designed)

Install Bun: https://bun.sh/docs/installation

```bash
# Terminal 1 — Backend
cd backend
bun server.ts

# Terminal 2 — Frontend
cd frontend
bun install
bun run dev
```

### Option B — With Node.js (no Bun required)

```bash
# Terminal 1 — Backend
cd backend
node server.mjs

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Features
- Kanban board: To Do / In Progress / Completed
- 10 pre-loaded sample tasks with comments
- Create, edit, delete tasks
- Priority (🔴🟡🟢) and category (emoji) labels
- Due date with overdue highlighting
- Task detail modal with comments section
- Confirmation dialog before deletion
- Persistent SQLite storage (tasks.db)
