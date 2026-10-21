# Looply — Agent Instructions

## Commands

Root convenience scripts (run from project root):

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
- Never read, print, or commit production `.env` files, credentials, or patient/health data (LGPD).
- Working copy is `~/looply`; production checkout is `/opt/looply` (`https://looply.verbumlab.com.br`). Do not run `git push` or database migrations without explicit user approval.

## Constraints (Demo V1 & Meta Tech Provider)

- Single-tenant / workspace-scoped (`AGENCY` and `LOCAL_BUSINESS` modes).
- Portuguese UI copy (`pt-BR`).
- Design system tokens live in `frontend/src/index.css` (`--looply-color-*`, warm coral `#f06d55` / canvas `#fff7f1` / ink `#2a171f`). Never introduce legacy `#2563eb` blue fallbacks.
- Public approval token is random (crypto), never a numeric id.
- Content status transitions are validated on the backend (`backend/src/domain/workflow.ts`).
- Broad `/api` routers with router-level `requireCapability` (`filesRouter`, `approvalsInternalRouter`, `mediaRouter`) must stay mounted after specific `/api/*` routers in `backend/src/app.ts`.

## Working Agreements & Toolkit Integration

- **Superpowers:** scale process (`brainstorming`, `writing-plans`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`) to task size. Explicit user instructions take precedence.
- **Ponytail (`full`):** deliver the smallest complete change that solves the task. Reuse existing patterns, tokens, and helpers; never cut corners on security, validation, error handling, or accessibility.
- **Caveman:** concise responses in Portuguese (`pt-BR`); full explanations when requested; normal wording in code, documentation, and commits.
- **Memory (`ai-memory` MCP):** use `memory_briefing`, `memory_recent`, `memory_query`, and `memory_handoff_list` at session start or before architectural changes.
- **Context7 MCP (`context7`):** query current library documentation (`resolve-library-id` → `query-docs`) when verifying React, Vite, Express, Prisma, Tailwind, or WhatsApp Cloud API details. Never send secrets or private code in queries.
- **Graphify (`graphify`):** use `GRAPHIFY_NO_AUTO_REFRESH=1 graphify query|path|explain` against `graphify-out/graph.json` for structural questions. Regenerate code graph with `GRAPHIFY_NO_AUTO_REFRESH=1 graphify extract . --code-only --no-cluster`.
- **RTK (`rtk`):** native hook active for Claude Code and Antigravity. Use `rtk proxy <cmd>` or `rtk bypass <cmd>` when full uncondensed output is required.

## Project Skills (`.agents/skills/` & `.claude/skills/`)

- `vercel-react-best-practices` & `vercel-composition-patterns`: React 18 / Vite component architecture, state, and rendering.
- `web-design-guidelines`: UI polish, accessibility, focus states, and layout review against Figma specs.
- `writing-guidelines`: documentation and UI microcopy clarity.
- `supabase-postgres-best-practices`: PostgreSQL schema, indexes, queries, and Prisma migration safety.
- `differential-review`: security-sensitive diff review (auth, webhooks, capabilities, external URLs, LGPD).
- `find-skills`: discover additional skills when a concrete capability gap arises.
