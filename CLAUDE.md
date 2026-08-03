# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TaskBoard

Full-stack Kanban/task-management app. React + TypeScript frontend (Vite), Node.js + TypeScript backend.

**This is the `t480-selfhosted` branch.** Deployed on a home server (the T480) at `gorpyniuk.com`
— no AWS at runtime. `main` is the original AWS version (Lambda + API Gateway + RDS Postgres +
CloudFront/S3, password reset via a Lambda that calls SES), still live and untouched at
`https://d1tvflu4vk8bmb.cloudfront.net`. **If you need to change backend behavior, decide first
which branch it belongs on** — there's no shared deploy target between them.

## What changed vs. `main`

Only `backend/auth.ts` and `backend/package.json` differ. Frontend is untouched — same build,
same `dist/`, same relative `/api/*` calls (`vite.config.ts`'s dev proxy already assumed a
same-origin API, so no frontend change was needed either).

**Password reset email:** `main` invokes an AWS Lambda function (`InvocationType: "Event"`,
fire-and-forget) which sends via SES. Here, `sendEmailAsync()` in `auth.ts` sends directly via
Gmail SMTP using `nodemailer` (`nodemailer.createTransport({ service: "gmail", ... })`), needs
`GMAIL_USER` + `GMAIL_APP_PASSWORD` (a Google Account → Security → App Passwords value, requires
2-Step Verification on that account — not the account's real password) in the environment. If
either is unset, `sendEmailAsync()` no-ops silently, same fail-open behavior as `main` when
`EMAIL_FUNCTION_NAME` was unset.

**Why the try/catch was added:** `main`'s Lambda invoke was fire-and-forget by AWS's own
`InvocationType: "Event"` semantics — Lambda's runtime owns the invocation lifecycle regardless
of whether it fails, and a failure there can't affect other invocations. Here, the whole backend
is one long-lived Node process handling every request — an uncaught rejection from a failed SMTP
send would otherwise take down request handling for every user, not just the one whose email
failed. `sendEmailAsync()` now catches and logs instead.

**Removed:** `@aws-sdk/client-lambda` dependency, `SES_FROM_EMAIL`/`EMAIL_FUNCTION_NAME` env vars
(replaced by `GMAIL_USER`/`GMAIL_APP_PASSWORD`). `APP_URL` still exists but its default changed
from the CloudFront URL to `https://gorpyniuk.com`.

**Not changed (known pre-existing issue, flagged not fixed here):** `server.ts` has two routes —
`/api/migrate` and `/api/admin/delete-user` — that run with no authentication at all, ahead of
the JWT check. The T480 deployment blocks both at the reverse-proxy layer (see `03_Setup/SITES.md`
in the ops repo, `N8N_Server_Setup_with_Claude`) rather than in this branch, so `main` and this
branch stay identical on that point. Fix in code here (and port to `main`) if you want it closed
at the source instead of just fenced off.

## Backend env vars (self-hosted)

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — plain Postgres connection (no
`?ssl=require` needed for the local shared instance; `db.ts` only forces SSL when `DB_HOST`
contains `rds.amazonaws.com`). `JWT_SECRET`, `PORT`, `APP_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`.
Full list and values: `03_Setup/SITES.md` in the ops repo.

**`NODE_ENV` must not be `"production"`.** `server.ts`'s local-HTTP-server block only starts when
`process.env.NODE_ENV !== "production"` — that check exists to distinguish "running under Lambda"
(prod) from "running as a normal process" (dev), but this branch runs it as a normal long-lived
process in both cases. Leave `NODE_ENV` unset (or anything other than `"production"`) in the
container, or the server never starts listening.
