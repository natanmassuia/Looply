# F0R.1 — Frontend Migration Final Plan (Execution Report)

- **Date:** 2026-08-15
- **Branch:** `feature/demo-v1-polish`
- **Initial HEAD:** `eef90c11a104a952b0d70c7f49cb770358b71089`
- **Final HEAD:** `eef90c11a104a952b0d70c7f49cb770358b71089` (before this report's docs commit)
- **Status:** `F0R.1 — PASS WITH BACKEND PREREQUISITES`

## Authority note

The historical F0R status was `F0R — BLOCKED: FIGMA_ACCESS_REQUIRED`. That blocker is NOT authoritative for the project: the orchestration layer verified the Figma file is accessible and current, and supplied the live Figma contract (file `8JDixNLJNe1f3KVPRwEFBi`) as authoritative planning input. This executor did not query Figma itself. Historical F0R docs (`docs/engineering/19-figma-frontend-contract-freeze.md`) were left untouched and remain accurate for what they recorded.

## Mandatory rules compliance

| Rule | Result |
|---|---|
| PREEXISTING_DIRTY_STATE_PRESERVED | YES (14 modified + 7 untracked preserved; staged empty at baseline) |
| UNRELATED_FILES_MODIFIED | NO |
| SOURCE_CODE_MODIFIED | NO |
| DATABASE_MUTATION | NO |
| RUNTIME_RESTART | NO |
| DEPLOY | NO |
| PUSH | NO |
| git reset/restore/clean/stash/add . /add -A | NEVER executed |

## Tasks executed

- **Task 1 — Reconcile F0R classifications:** new consolidation in `docs/engineering/20-frontend-migration-final-plan.md` §2 (all UNVERIFIED resolved against supplied Figma: COLOR→C, TYPOGRAPHY→C confirmed, RADIUS/SHADOW/BUTTON/PILL→B, CALENDAR→B extended, APPROVAL→B, TEMPLATE→D frontend-only, THEME→C product contract + persistence). Historical docs untouched.
- **Task 2 — Backend prerequisite audit:** read `schema.prisma`, `domain/capabilities.ts`, `routes/auth.ts`, `routes/onboarding.ts`, `routes/members.ts`, `routes/team.ts` service, `services/appointmentService.ts`, `app.ts`, `lib/env.ts`. Confirmed: no theme fields (A), WorkspaceContext is the exposure point (B), no post-onboarding settings endpoint (C), no member color (D), no appointment responsible member (E), no notifications model + no Figma page (F → drop), no integration/account model (G), onboarding first-access/company/template/complete supported but appearance + recovery missing (H).
- **Task 3 — Remove fake prerequisites:** old BP1 KEEP; old BP2/Bp3 MERGE into BP1; old BP4 MOVE (performance → post-migration cleanup, H1/H2 OBSOLETE_AFTER_ROUTE_MIGRATION).
- **Task 4 — Final BPs:** BP1 Workspace Appearance Persistence (schema+migration+GET/PATCH+WorkspaceContext), BP2 Team Operational Color, BP3 Appointment Responsible Member, BP4 Access Recovery (gated on email delivery).
- **Task 5–6 — Battery plan + contracts:** F1–F14 final order with dependency gating (F4B/F11B/F12 ← BP1; F8 ← BP2+BP3; F9 ← BP2; F4A recovery ← BP4; F1/F2/F3 BP-free). Concise contracts in doc §8.
- **Task 7 — Theme architecture freeze:** WorkspaceAppearance → resolveTheme() → semantic `--looply-*` roles → components → screens; authorities + hydration + fallback + FOUC + contrast in doc §6.
- **Task 8 — Template architecture freeze:** existing enum + capabilities + frontend presentation defaults; no new enum, no three route trees (doc §7).
- **Task 9 — Integration state model:** NOT_AVAILABLE / AVAILABLE_NOT_CONFIGURED / CONFIGURATION_REQUIRED / CONNECTED / DEGRADED / ERROR; Meta+Gupshup = AVAILABLE_NOT_CONFIGURED, Google Drive = NOT_AVAILABLE; server-authority, no client inference, no secrets (doc §9).
- **Task 10 — Route migration:** target route table + legacy `/contents*` → `/jobs*` redirects (doc §10).
- **Task 11 — Performance triage:** H1/H2 → OBSOLETE_AFTER_ROUTE_MIGRATION (non-blocking).
- **Task 12 — Security contract:** CRITICAL=0, HIGH=0; MEDIUM items carried to battery backend work (doc §12).
- **Task 13 — Docs:** `docs/engineering/20-frontend-migration-final-plan.md` + this report.
- **Task 14 — NOTION_UPDATE_PAYLOAD:** below.
- **Task 15 — Validation:** see gates below (backend 336, frontend 32).
- **Task 16 — Git safety:** staged only the two F0R.1 docs; commit `docs(v1): finalize frontend migration plan`.

## Validation gates

- Backend: typecheck PASS · test **336 passing** · build PASS · prisma:validate PASS
- Frontend: typecheck PASS · test **32 passing** · build PASS

## NOTION_UPDATE_PAYLOAD

```
STATUS: F0R.1 — PASS WITH BACKEND PREREQUISITES (planning freeze, no code changed)
F0R REPO-SIDE: completed (docs/engineering/19 + .dev-reports/looply-f0r-figma-frontend-contract-freeze.md)
FIGMA BLOCKER: resolved at orchestration layer; live Figma verified current and authoritative for this plan
LIVE FIGMA PAGES: 00 Brand, 01 Foundations, 02 Logo, 03.1-03.18 Components, 04 App Shell, 05 Access & Onboarding,
  06 Dashboard, 07/07.1 Clients, 08/08.1 Jobs, 09 Calendar, 10 Team, 11 Public Approval, 12/12.1/12.2/12.3
  Settings + Theme Selector + Integrations + Theme Coverage, 13 Screen States & QA, 90 Mobile, 99 Archive
KEY NEW PRODUCT CONTRACTS: Theme = persisted workspace product contract (presets Aura/Flux/Pulse/Customizado,
  light/dark, custom 6 colors, onboarding Appearance step); sidebar 272px + mobile bottom nav; Jobs canonical
  vocabulary (Quadro/Lista + client grouping); Calendar Semana/Agenda + member color + appointment CRUD;
  Team operational color; internal Approval queue; Settings split Core/Appearance/Integrations;
  Screen States & QA page; no public self-signup (provisioned by Verbum Lab)
FINAL BACKEND PREREQUISITES: BP1 Workspace Appearance Persistence (Company appearancePreset/Mode/CustomColors +
  WorkspaceContext.appearance + GET/PATCH /api/settings/appearance) · BP2 Team Operational Color (CompanyMember.color) ·
  BP3 Appointment Responsible Member (Appointment.responsibleMemberId) · BP4 Access Recovery (forgot/reset password,
  gated on email delivery)
FINAL BATTERY SEQUENCE: F1 Semantic+Theme Runtime (no BP) → F2 Components → F3 App Shell+Nav → F4A Access/Recovery
  (BP4) → F4B Onboarding (BP1) → F5 Dashboard by Template → F6A/F6B Clients → F7A/F7B Jobs → F8 Calendar (BP2+BP3) →
  F9 Team (BP2) → F10 Approvals → F11A/B/C Settings (BP1) → F12 Theme Coverage → F13 States/A11y/Responsive →
  F14 Staging E2E + Visual Acceptance
IMMEDIATE NEXT TASK: BP1 (Workspace Appearance Persistence) — schema + migration + GET/PATCH + WorkspaceContext,
  then F1 + F4B
GUPSHUP STATE: implemented, no live credentials/config → frontend must show AVAILABLE_NOT_CONFIGURED, never CONNECTED
REMAINING EXTERNAL DEPENDENCIES: Figma read access for F14 visual QA; email delivery provider for BP4;
  live WhatsApp credentials (Meta/Gupshup) for CONNECTED state; live DB for migrations/seeds
ENGINEERING DOC: docs/engineering/20-frontend-migration-final-plan.md
REPORT: .dev-reports/looply-f0r1-frontend-migration-final-plan.md
```

## Final structured output

```
STATUS: F0R.1 — PASS WITH BACKEND PREREQUISITES
BRANCH: feature/demo-v1-polish
INITIAL_HEAD: eef90c11a104a952b0d70c7f49cb770358b71089
FINAL_HEAD: <set by docs commit>
COMMIT: <set by docs commit> (docs(v1): finalize frontend migration plan)
HISTORICAL_F0R_STATUS: F0R — BLOCKED: FIGMA_ACCESS_REQUIRED (repo-side, historically accurate)
FIGMA_BLOCKER_PROJECT_LEVEL: RESOLVED at orchestration layer; not authoritative for the project
FIGMA_AUTHORITY_SOURCE: orchestration-supplied live Figma contract, file 8JDixNLJNe1f3KVPRwEFBi (authoritative)
FIGMA_PAGE_COUNT: 20 documented page groups (00-99) per supplied inventory
LIVE_FIGMA_NEW_CONTRACTS: Theme as persisted workspace product contract (presets Aura/Flux/Pulse/Customizado + light/dark + custom 6 colors + onboarding Appearance); App Shell 272px sidebar + mobile bottom nav; Jobs canonical Quadro/Lista + client grouping; Calendar Semana/Agenda + member color + appointment CRUD; Team operational color; internal Approval queue; Settings Core/Appearance/Integrations split; Screen States & QA; no public self-signup
THEME_RUNTIME_CURRENT: NO (F1 builds it; BP-free local default)
THEME_PERSISTENCE_CURRENT: NOT_SUPPORTED (needs BP1)
LIGHT_DARK_CURRENT: NO (BP1 mode + F1 runtime)
CUSTOM_THEME_CURRENT: NO (BP1 custom colors + F1 derivation)
WORKSPACE_TEMPLATE_BACKEND: SUPPORTED (LOCAL_BUSINESS/HIGH_TICKET/MARKETING_AGENCY + capabilities registry)
TEMPLATE_RUNTIME_CURRENT: PARTIAL (backend ready; frontend lacks template UX — F3/F5)
MEMBER_COLOR_BACKEND: NOT_SUPPORTED (needs BP2)
APPOINTMENT_RESPONSIBLE_MEMBER_BACKEND: NOT_SUPPORTED (needs BP3)
ONBOARDING_BACKEND: PARTIAL — first access/forced change/company/template/complete SUPPORTED; appearance selection MISSING (BP1); recovery/reset MISSING (BP4)
INTEGRATIONS_BACKEND: no persisted account model; Meta+Gupshup env-config only, Google Drive absent → truthful AVAILABLE_NOT_CONFIGURED / NOT_AVAILABLE
APPROVAL_BACKEND: SUPPORTED (256-bit token, one-time, 7d, hash-at-rest, version pinning)
BP_REVIEW_BP1: KEEP (Workspace Appearance Persistence — schema+migration+GET/PATCH+WorkspaceContext)
BP_REVIEW_BP2: MERGE into BP1 (WorkspaceContext exposure + write path are one contract)
BP_REVIEW_BP3: MERGE into BP1 (same schema change; read/write settings endpoint)
BP_REVIEW_BP4: MOVE — performance pagination → post-migration cleanup (H1/H2 OBSOLETE_AFTER_ROUTE_MIGRATION, not a foundation prerequisite)
FINAL_BACKEND_PREREQUISITES: BP1 Workspace Appearance Persistence · BP2 Team Operational Color · BP3 Appointment Responsible Member · BP4 Access Recovery (gated on email)
FINAL_THEME_ARCHITECTURE: WorkspaceAppearance {preset,mode,customColors} → resolveTheme() → semantic --looply-* roles on <html data-theme> → components → screens; server authority; local AURA/LIGHT fallback; FOUC-safe SPA bootstrap; WCAG AA contrast
FINAL_TEMPLATE_ARCHITECTURE: existing workspaceTemplate enum + capabilities + frontend presentation defaults (nav config, dashboard modules, jobs default mode, labels); one route tree; no duplicated Dashboard
FINAL_INTEGRATION_STATE_MODEL: NOT_AVAILABLE | AVAILABLE_NOT_CONFIGURED | CONFIGURATION_REQUIRED | CONNECTED | DEGRADED | ERROR; Meta=AVAILABLE_NOT_CONFIGURED, Gupshup=AVAILABLE_NOT_CONFIGURED, Google Drive=NOT_AVAILABLE; server-authority, no secrets
ROUTE_MIGRATION_PLAN: /login, /forgot-password, /reset-password, /change-password, /onboarding/*, /dashboard, /clients, /clients/:id, /jobs, /jobs/new, /jobs/:id, /calendar, /team, /approvals, /settings, /settings/appearance, /settings/integrations, /approve/:token; legacy /contents* → /jobs* redirects through F14
H1_CONTENTS_TRIAGE: OBSOLETE_AFTER_ROUTE_MIGRATION → POST-MIGRATION CLEANUP (non-blocking)
H2_PUBLICATIONS_TRIAGE: OBSOLETE_AFTER_ROUTE_MIGRATION → POST-MIGRATION CLEANUP (non-blocking)
FINAL_BATTERY_SEQUENCE: F1 Semantic+Theme Runtime → F2 Components → F3 App Shell+Nav → F4A Access/Recovery → F4B Onboarding → F5 Dashboard by Template → F6A/F6B Clients → F7A/F7B Jobs → F8 Calendar+Appointments → F9 Team → F10 Approvals → F11A/B/C Settings → F12 Theme Coverage → F13 States/A11y/Responsive → F14 Staging E2E+Visual Acceptance
NEXT_BATTERY: F1 — Semantic Foundations + Theme Runtime
NEXT_BATTERY_BLOCKED_BY_BP: none (F1 runs on local AURA/LIGHT default; BP1 needed only for F4B/F11B/F12, BP2+BP3 for F8/F9, BP4 for F4A recovery)
BACKEND_TEST_COUNT: 336
BACKEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
PRISMA_VALIDATE: PASS
FRONTEND_TEST_COUNT: 32
FRONTEND_TYPECHECK: PASS
FRONTEND_BUILD: PASS
SECURITY_CRITICAL: 0
SECURITY_HIGH: 0
SECURITY_MEDIUM: 9 (carried to battery backend work, non-blocking)
PERFORMANCE_BLOCKERS: 0 (H1/H2 triaged OBSOLETE_AFTER_ROUTE_MIGRATION, non-blocking)
SOURCE_CODE_MODIFIED: NO
DATABASE_MUTATION: NO
PREEXISTING_DIRTY_STATE_PRESERVED: YES
UNRELATED_FILES_MODIFIED: NO
ENGINEERING_DOC: docs/engineering/20-frontend-migration-final-plan.md
REPORT: .dev-reports/looply-f0r1-frontend-migration-final-plan.md
NOTION_UPDATE_PAYLOAD: see section above
REMAINING_BLOCKERS: Figma read access for F14 visual QA (project layer); email delivery provider for BP4; live WhatsApp credentials (Meta/Gupshup) for CONNECTED state; live DB for migrations
NEXT_STEP: Execute BP1 (Workspace Appearance Persistence): schema + migration + GET/PATCH /api/settings/appearance + WorkspaceContext.appearance + tests; then F1 (Semantic Foundations + Theme Runtime) and F4B onboarding Appearance.
```