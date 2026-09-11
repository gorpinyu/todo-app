# TaskBoard

A full-stack task management web application with Kanban board, calendar view, project management, multi-user authentication, and a native mobile app.

**Live:** https://gorpyniuk.com

Built with AI coding tools (Claude Code and Kiro). Originally designed and deployed on AWS, then migrated to a self-hosted Docker stack on a home server when the AWS free tier ended. Both versions live in this repository, see [Deployments and branches](#deployments-and-branches).

---

## Deployments and branches

| Branch | Status | Where it runs |
|---|---|---|
| `t480-selfhosted` | **Production** (what https://gorpyniuk.com serves) | Home server (Lenovo T480): Docker containers behind Caddy, published through a Cloudflare Tunnel, shared PostgreSQL container |
| `main` | Original AWS architecture, kept as reference | AWS Lambda + API Gateway, RDS PostgreSQL, CloudFront + S3, SES, deployed with AWS CDK |

The frontend build is identical on both branches. The backend differs only in how it is hosted and how password-reset email is sent (SES via Lambda on `main`, Gmail SMTP via `nodemailer` on `t480-selfhosted`). The self-hosted branch also adds Google OAuth sign-in.

---

## Features

### Task Management
- Kanban board with three columns: To Do / In Progress / Completed
- Create, edit, and update tasks with title, description, priority, category, and due date
- Drag-and-drop tasks between columns
- Priority labels (🔴 High / 🟡 Medium / 🟢 Low) with colour-coded left border
- Category labels with emoji (Work, Personal, Health, Learning, Finance, Shopping)
- Due date with overdue highlighting
- Task completion date tracking with "completed late" indicator
- Task detail modal with comments section
- Sidebar filters: All Tasks, To Do, In Progress, Completed, Overdue

### Project Management
- Create multiple projects to organize tasks
- Switch between projects from sidebar
- Archive projects (requires no tasks or moves tasks to archive)
- Restore archived projects
- Permanently delete archived projects
- Default "Personal" project protected from deletion
- Full user data isolation - each user sees only their own projects

### Archive
- Deleting a task moves it to Archived Tasks (soft-delete) — data is preserved
- Archive view shows all archived tasks with status, due date, and category
- Restore a task from archive back to the main board with its original status
- Permanently delete tasks from archive
- Separate Archived Projects view for project management

### Calendar View
- Monthly and weekly calendar views with toggle buttons
- Drag-and-drop tasks to change due dates (including Friday/Saturday fix)
- Double-click tasks to open detail modal
- Completed tasks display by completion date instead of due date
- Colour-coded by status: grey (To Do), yellow (In Progress), green (Completed)
- Overdue tasks shown in red
- Navigate forward and backward through months/weeks
- Calendar state persists during drag-and-drop operations
- Timezone-aware date handling to prevent date shifting
- Archived tasks excluded from calendar

### Authentication
- Email and password registration — each user has their own isolated task board
- Sign in with Google (server-side OAuth authorization-code flow, `t480-selfhosted` branch)
- JWT-based authentication with 7-day token expiry
- Password reset via email (Gmail SMTP on `t480-selfhosted`, AWS SES on `main`)
- Contextual login error messages with reset and register shortcuts
- Secure sign out with full state cleanup

### Dark Mode & Theming
- Light, dark, and system theme modes (web and mobile)
- Persistent theme preference saved to localStorage/AsyncStorage
- Settings modal with theme selector
- Fully themed UI components including modals, forms, and calendar
- Smooth theme transitions

### Mobile App
- Native iOS and Android app built with React Native and Expo
- Full feature parity with web app
- Project-based task filtering
- Calendar view with month/week toggle
- Dark mode support with system preference detection
- Offline-capable with AsyncStorage for preferences
- Touch-optimized UI with native gestures

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Mobile | React Native, Expo, TypeScript |
| Backend | Node.js, TypeScript |
| Database | PostgreSQL |
| Auth | bcryptjs, jsonwebtoken, Google OAuth (`t480-selfhosted`) |

### Hosting, `t480-selfhosted` (production)

| Layer | Technology |
|---|---|
| Backend runtime | Long-lived Node.js process in a Docker container (`backend/Dockerfile`, multi-stage `node:20-alpine`) |
| Frontend | Static `dist/` served by Caddy from a Docker container |
| Database | Shared PostgreSQL container on the same host |
| Email | Gmail SMTP via `nodemailer` |
| Edge | Caddy reverse proxy, published through a Cloudflare Tunnel (no open inbound ports) |
| Deploy | `git push` to `t480-selfhosted` picked up by a systemd timer that rebuilds and restarts the containers |

### Hosting, `main` (original AWS architecture)

| Layer | Technology |
|---|---|
| API | AWS API Gateway HTTP API + Lambda |
| Database | PostgreSQL on Amazon RDS |
| Email | AWS SES (async via Lambda) |
| Frontend hosting | AWS CloudFront + S3 |
| Infrastructure | AWS CDK (Python), see `infra/` |

---

## Local Development

### Prerequisites
- Node.js 20+
- Bun (optional, for backend dev)
- Docker (for local PostgreSQL)

### Start local PostgreSQL
```bash
docker run -d --name todo-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=todo \
  -p 5432:5432 postgres:16
```

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to `http://localhost:3001` via Vite config.

---

## Deploy

### Self-hosted (`t480-selfhosted`)

The server runs a systemd timer that pulls the branch, builds `backend/Dockerfile` and the frontend, and restarts the containers behind Caddy. In practice a deploy is:

```bash
git push origin t480-selfhosted
```

Backend environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`, `APP_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Leave `NODE_ENV` unset: the server only starts its HTTP listener when `NODE_ENV` is not `"production"` (that check originally distinguished Lambda from local runs).

### AWS (`main`)

```bash
# Build backend
cd backend
Remove-Item -Recurse -Force dist
npx tsc
Copy-Item -Recurse -Force node_modules dist/node_modules

# Build frontend
cd frontend
npm run build

# Deploy
cd infra
cdk deploy -c account=YOUR_ACCOUNT_ID -c region=us-east-1 --require-approval never
```

---

## Project Structure

```
todo-app/
├── backend/
│   ├── server.ts     # HTTP server + Lambda handler
│   ├── routes.ts     # Task, project, archive, comment routes
│   ├── auth.ts       # Register, login, Google OAuth, password reset
│   ├── db.ts         # PostgreSQL pool + schema + seed
│   └── Dockerfile    # Self-hosted container image (t480-selfhosted)
├── frontend/
│   └── src/
│       ├── components/   # Board, TaskCard, CalendarView, ArchiveView, ProjectArchiveView, modals
│       ├── pages/        # Login, Register, ForgotPassword, ResetPassword
│       ├── context/      # AuthContext, ProjectContext
│       └── api.ts        # API client
├── mobile/, taskboard-mobile/   # React Native + Expo app
└── infra/
    └── src/
        ├── app.py        # CDK entry point (AWS, main branch)
        └── stack.py      # AWS infrastructure
```

---

## Release History

| Tag | Description |
|---|---|
| `v1.0-backup` | Initial Kanban board (SQLite, no auth) |
| `v1.1-auth` | Multi-user auth, PostgreSQL, AWS deployment |
| `v1.2-archive-calendar` | Archive (soft-delete) + Calendar view |
| `v1.3` | Password reset, restore from archive, overdue calendar highlighting |
| `v1.4` | Task completion dates, project management, enhanced calendar (week view, drag-drop), user data isolation fixes |
| `v1.5` | Dark mode support (web + mobile), mobile app with project support, calendar improvements (completion date display, timezone fixes, Friday/Saturday drag-drop fix) |
| `t480-selfhosted` | Google OAuth sign-in, Gmail SMTP for password reset, Docker image, migration from AWS to a self-hosted server |

---

## Security Features

- JWT-based authentication with secure token verification
- Password hashing with bcryptjs (12 rounds)
- User data isolation - all database queries filtered by user_id
- Secure logout with full localStorage cleanup and page reload
- Protected default project from deletion
- Comment ownership verification before deletion
- Task ownership verification for all operations
- Self-hosted deployment exposes nothing directly to the internet: Cloudflare Tunnel to Caddy, with maintenance routes blocked at the proxy
