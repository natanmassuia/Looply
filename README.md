# Looply

Operational content workflow application for marketing / social-media agencies.
Centralizes the content lifecycle: production → internal review → client
approval → scheduling → publication.

> **Status:** Demo V1 (single-tenant, development). Not production-hardened.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand
- **Backend:** Node.js 24, TypeScript, Express
- **Database:** PostgreSQL + Prisma

## Repository layout

```
/opt/looply
├── frontend/      internal SPA + public approval page
├── backend/       Express API + Prisma
├── .dev-reports/  implementation reports
├── .env.example
└── package.json   root orchestration scripts
```

## Quick start

```bash
# 1. install (root orchestrates both apps)
cp .env.example .env          # then edit DATABASE_URL
npm run install:all

# 2. database
npm run db:generate           # prisma generate
npm run db:migrate            # create/apply migration (needs DB)
npm run db:seed               # seed demo data (needs DB)

# 3. run
npm run dev:backend           # http://localhost:4000
npm run dev:frontend          # http://localhost:5173
```

## Validation

```bash
npm --prefix backend run typecheck && npm --prefix backend run test && npm --prefix backend run build
npm --prefix frontend run typecheck && npm --prefix frontend run test && npm --prefix frontend run build
```

## Primary workflow

```
DRAFT → IN_REVIEW → AWAITING_CLIENT → (CHANGES_REQUESTED → IN_REVIEW)* → APPROVED → SCHEDULED → PUBLISHED
```

The **public client approval** experience lives at `/approve/:token` (outside the
internal sidebar). Tokens are random, non-sequential, and map only to a specific
content version + client.

## Demo / dev notes

- **DEV_DEMO_USER=true** boots the internal app as a hardcoded demo admin. This
  is explicitly NOT production authentication.
- Local media uploads (when used) land in `backend/uploads/` and are dev-only.
