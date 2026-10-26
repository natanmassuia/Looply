# Looply

WhatsApp-first customer operations for local businesses and agencies. Each
workspace receives and replies on **its own WhatsApp number**, an **AI
assistant** books appointments and answers questions from the business's own
registered context, and a shared **appointment calendar** prevents
double-booking and out-of-hours slots. A client content-approval workflow is
also included for agency use.

> **Status:** V1. Single database per deployment, workspace-scoped
> (`AGENCY` and `LOCAL_BUSINESS` modes). UI copy is Portuguese (`pt-BR`).

## What it does

- **WhatsApp inbox (per-company number).** Inbound is routed to the owning
  company by the Meta `phone_number_id`; every reply (AI or human) leaves via
  that same company's number. One Meta access token, many company numbers.
- **AI assistant.** Interprets a customer message into one action: schedule /
  reschedule an appointment, or answer a question. It answers **only** from the
  company's "Sobre o seu negócio" text (services, prices, hours, address);
  anything it cannot answer from that text is handed off to a human
  (`NEEDS_ATTENTION`) — it never invents facts.
- **Appointment calendar.** Server-side guards reject overlapping appointments
  (race-safe via a per-company advisory lock + transaction) and slots outside
  the configured business hours, and the assistant offers the next free slots
  when it refuses.
- **Client approval workflow.** Content moves
  `DRAFT → IN_REVIEW → AWAITING_CLIENT → (CHANGES_REQUESTED → IN_REVIEW)* →
  APPROVED → SCHEDULED → PUBLISHED`. The public approval page lives at
  `/approve/:token` (random, non-sequential token → one content version +
  client), outside the internal sidebar.

## Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS, TanStack Query, Zustand
- **Backend:** Node.js ≥ 22, TypeScript, Express 4
- **Database:** PostgreSQL + Prisma 5
- **Integrations:** WhatsApp Cloud API (Meta), MinIO/S3 object storage, Resend (mail)

## Repository layout

```
looply/
├── frontend/      internal SPA + public approval page
├── backend/       Express API + Prisma (schema, migrations, services, routes)
├── ops/           deploy, nginx, systemd, backup/restore + restore drill
├── docs/          engineering + security notes
├── .env.example
└── package.json   root orchestration scripts
```

## Quick start

```bash
# 1. install (root orchestrates both apps)
cp .env.example .env          # then edit DATABASE_URL (and integration keys)
npm run install:all

# 2. database
npm run db:generate           # prisma generate (no DB needed)
npm run db:migrate            # apply migrations (needs DB)
npm run db:seed               # seed demo data (needs DB)

# 3. run
npm --prefix backend run dev    # http://localhost:4000
npm --prefix frontend run dev   # http://localhost:5173
```

### Provision a workspace (CLI, no UI)

```bash
# Creates the company + owner, prints the temp password once. Add a WhatsApp
# number in the same command with --phone-number-id.
npx tsx backend/src/scripts/provision.ts "Owner Name" owner@email.com "Company" \
  --phone-number-id <meta_phone_number_id> [--source-phone +5511999998888]
```

## Validation

```bash
npm --prefix backend run typecheck && npm --prefix backend run test && npm --prefix backend run build
npm --prefix frontend run typecheck && npm --prefix frontend run test && npm --prefix frontend run build
```

Pure-logic unit tests and schema validation/client generation do **not** need a
live DB; migration/seed and DB-gated tests do (`DATABASE_URL`).

## Operations

- **Backup / restore / DR:** `ops/backup/` (`backup.sh`, `restore.sh`,
  `verify.sh`, `README.md`). A proven empty-DB restore drill is documented in
  `ops/backup/RESTORE-DRILL.md`.
- **Deploy:** `ops/deploy/`, `ops/nginx/`, `ops/systemd/`. Production runs at
  `https://looply.verbumlab.com.br` from `/opt/looply`.

## Configuration & secrets

- All configuration is read from `.env`. Secrets live **only** in `.env`, which
  is gitignored (`.env`, `.env.local`, `.env.*.local`, `.env.backup.*`); only
  `.env.example` (placeholders) is committed. Never commit or print real
  secrets, and never read/print production `.env` or patient/health data (LGPD).
- Unexpected 5xx failures are logged server-side as structured
  `unhandled_error` records (with request id, path, and stack) via the error
  handler, and routed through a pluggable error-reporting seam; stack traces are
  never returned to clients (only added to the response body in `development`).
- **DEV_DEMO_USER=true** boots the app as a hardcoded demo admin — explicitly
  NOT production authentication. Local media under `backend/uploads/` is
  dev-only; durable media lives in object storage.
