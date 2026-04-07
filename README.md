# TaskBoard

A full-stack task management web application with Kanban board, calendar view, project management, and multi-user authentication — deployed on AWS.

**Live:** https://d1tvflu4vk8bmb.cloudfront.net

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
- Monthly and weekly calendar views
- Drag-and-drop tasks to change due dates
- Double-click tasks to open detail modal
- Colour-coded by status: grey (To Do), yellow (In Progress), green (Completed)
- Overdue tasks shown in red
- Navigate forward and backward through months/weeks
- Archived tasks excluded from calendar

### Authentication
- Email and password registration — each user has their own isolated task board
- JWT-based authentication with 7-day token expiry
- Password reset via email (AWS SES)
- Contextual login error messages with reset and register shortcuts
- Secure sign out with full state cleanup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, TypeScript |
| Database | PostgreSQL (AWS RDS) |
| Auth | bcryptjs, jsonwebtoken |
| Email | AWS SES (async via Lambda) |
| Hosting | AWS CloudFront + S3 |
| API | AWS API Gateway HTTP API + Lambda |
| Infrastructure | AWS CDK (Python) |

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

## Deploy to AWS

See [.kiro/steering/deploy.md](.kiro/steering/deploy.md) for the full deploy workflow.

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
│   ├── auth.ts       # Register, login, password reset
│   └── db.ts         # PostgreSQL pool + schema + seed
├── frontend/
│   └── src/
│       ├── components/   # Board, TaskCard, CalendarView, ArchiveView, ProjectArchiveView, modals
│       ├── pages/        # Login, Register, ForgotPassword, ResetPassword
│       ├── context/      # AuthContext, ProjectContext
│       └── api.ts        # API client
└── infra/
    └── src/
        ├── app.py        # CDK entry point
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

---

## Security Features

- JWT-based authentication with secure token verification
- Password hashing with bcryptjs (12 rounds)
- User data isolation - all database queries filtered by user_id
- Secure logout with full localStorage cleanup and page reload
- Protected default project from deletion
- Comment ownership verification before deletion
- Task ownership verification for all operations
