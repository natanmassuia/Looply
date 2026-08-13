# Looply — agent notes

## Commands

Root convenience scripts (run from /opt/looply):

- `npm run install:all` — install backend + frontend deps
- `npm run typecheck` — typecheck both apps
- `npm run test` — run both test suites
- `npm run build` — build both apps
- `npm run db:generate` / `db:validate` / `db:migrate` / `db:seed`

Per-app:

- backend:  `npm --prefix backend run dev|build|typecheck|test|seed|prisma:*`
- frontend: `npm --prefix frontend run dev|build|typecheck|test`

Always run after edits:

```bash
npm --prefix backend run typecheck && npm --prefix backend run test
npm --prefix frontend run typecheck && npm --prefix frontend run test
```

## Environment

- Copy `.env.example` → `.env`. `DATABASE_URL` is required for runtime DB
  (migrate/seed/live API). Schema validation + client generation + pure-logic
  unit tests do NOT need a live DB.
- `DEV_DEMO_USER=true` enables the hardcoded demo admin (dev only).

## Constraints (Demo V1)

- Single-tenant. No multi-tenancy abstractions.
- Portuguese UI copy.
- Public approval token is random (crypto), never a numeric id.
- Content status transitions are validated on the backend (`backend/src/domain/workflow.ts`).
- Sidebar is exactly: Dashboard, Contents, Calendar, Clients, Team (no Integrations).
