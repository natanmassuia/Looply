# 20. Frontend Migration Final Plan (F0R.1)

Status: **PLANNING FREEZE — F0R.1 PASS WITH BACKEND PREREQUISITES**. No code changed by this plan.

**Authority note:** the repo-side F0R blocker (FIGMA_ACCESS_REQUIRED) was resolved at the **orchestration layer**, which has verified the live Figma file is accessible and current. The current Figma contract (file `8JDixNLJNe1f3KVPRwEFBi`) was supplied to this executor as **authoritative planning input** and is treated as such throughout. The historical repo-side F0R report (`docs/engineering/19-figma-frontend-contract-freeze.md`) remains historically accurate and is NOT rewritten.

This document consolidates: F0R repo findings + live Figma contract + current backend/frontend reality → final migration plan. It freezes architecture and order; it does NOT implement.

## 1. Live Figma authority (supplied)

- File: `8JDixNLJNe1f3KVPRwEFBi` — pages: 00 Brand Direction, 01 Foundations, 02 Logo & Symbol, 03.1–03.18 Components, 04 App Shell, 05 Access & Onboarding, 06 Dashboard, 07/07.1 Clients, 08/08.1 Jobs, 09 Calendar, 10 Team, 11 Public Approval, 12/12.1/12.2/12.3 Settings + Theme Selector + Integrations + Theme Coverage, 13 Screen States & QA, 90 Mobile, 99 Archive.
- Brand "Human Relay"; typography Manrope; palette aubergine/950 `#2A171F`, coral/500 `#F06D55`, amber/400 `#F3B84B`, coral/100 `#FFE3D7`, cream/100 `#FFF7F1`; semantic Light/Dark modes; spacing 16/24/32/64; radius md 10 / lg 16 / full; three elevation levels.

## 2. Reconciled classifications (F0R.1 vs F0R)

| Contract | F0R | F0R.1 resolved |
|---|---|---|
| COLOR_CONTRACT | B (UNVERIFIED) | **C** — repo blue `#2563eb` vs Figma coral `#F06D55`: known contradiction |
| TYPOGRAPHY_CONTRACT | C (brief-based) | **C confirmed** — Inter vs Figma Manrope |
| RADIUS_CONTRACT | B | **B** — repo 6/8/10/12/16 + pill; Figma md 10 / lg 16 / full: aligned, map to token set |
| SHADOW_CONTRACT | B | **B** — repo 4 levels; Figma 3 documented: map to 3 levels |
| BUTTON_CONTRACT | B | **B** — Figma 03.1; repo `.btn*` pill: aligned |
| STATUS_PILL_CONTRACT | B | **B** — Figma 03.2 Badge; repo `StatusPill`: aligned |
| CALENDAR_CONTRACT | B | **B (extended)** — Figma 09 adds Semana/Agenda, team filter, member color (BP2), appointment CRUD (BP3) |
| APPROVAL_CONTRACT | A | **B** — public page + security A; internal approval queue surface missing (F10) |
| TEMPLATE_RUNTIME_CONTRACT | D | **D (frontend only)** — backend fully supports 3 templates; frontend lacks template UX (F3/F5) |
| THEME_CONTRACT | D (no prereq) | **C (product contract + persistence)** — theme is now a persisted workspace product contract (12.1, onboarding Appearance); backend needs BP1, frontend needs F1 |

## 3. Backend prerequisite audit (read from schema/routes/services)

| Contract | Current reality | Resolution |
|---|---|---|
| A. Workspace theme persistence | `Company` has NO theme fields (`schema.prisma:139-167`) | **BP1** |
| B. WorkspaceContext exposure | `WorkspaceContext {id,name,template,capabilities,status}` via `/api/auth/me` (`capabilities.ts:87-106`, `auth.ts:95-133`) | Extend WorkspaceContext with `appearance` (BP1). No parallel theme-session API. |
| C. Theme write path | No post-onboarding settings/company endpoint (onboarding PATCH `/company` is pre-onboarding gated, `onboarding.ts:35-56`) | **BP1** adds minimal GET/PATCH |
| D. CompanyMember operational color | `CompanyMember` = role/isActive only (`schema.prisma:169-184`; `members.ts:22-25`) | **BP2** |
| E. Appointment responsible member | Only `createdByUserId` (actor); no `Responsável` (`schema.prisma:461-479`) | **BP3** |
| F. Notifications settings | No model anywhere; Figma has no Notifications page | NOT a prerequisite — DROP |
| G. Integrations state | No persisted integration/account model; Meta/Gupshup config = server env (`env.ts:34-41`); no Google Drive | Truthful state model, no BP |
| H. Access/onboarding persistence | temp password + forced change SUPPORTED (`onboardingService.ts:35`, `requireAuth.ts`, `auth.ts:58-93`); company + template + complete SUPPORTED (`onboarding.ts`); appearance selection MISSING (BP1); **recovery/reset MISSING** (no forgot/reset routes) | **BP1 + BP4** |

## 4. Final backend prerequisites (BP1–BP4)

### BP1 — Workspace Appearance Persistence
- **WHY:** theme is a persisted workspace product contract (Figma 12.1, onboarding Appearance). No storage exists.
- **EXACT CONTRACT:** add appearance fields to `Company` (or a `WorkspaceAppearance` row keyed to Company): `appearancePreset enum? (AURA|FLUX|PULSE|CUSTOM)`, `appearanceMode enum? (LIGHT|DARK)`, `appearanceCustomColors String[]` (≤6 hex). Extend `WorkspaceContext` → `appearance: { preset, mode, customColors? }`. Add `GET/PATCH /api/settings/appearance` (workspace-scoped, server validates hex allowlist + preset/mode enums). `/api/auth/me` returns `workspace.appearance` (fallback AURA/LIGHT).
- **SCHEMA_CHANGE:** YES · **MIGRATION:** YES
- **FRONTEND BATTERY BLOCKED:** F4B (onboarding Appearance), F11B (Theme Selector), F12 (coverage). **NOT** F1 — F1 runs on a local default (AURA/LIGHT) until BP1 lands.
- **TESTS REQUIRED:** appearance persist/read/validate/update; WorkspaceContext shape; hex + enum validation; authz (ADMIN/OWNER only).

### BP2 — Team Operational Color
- **WHY:** Figma 10 Team (color selection Coral/Âmbar/Teal/Verde) and 09 Calendar (member color on appointments + filter).
- **EXACT CONTRACT:** add `CompanyMember.color String?` (validated hex; palette-preset allowed). Include in `/api/members` + `/api/team` payloads. `PATCH /api/members/:id` accepts `color`. Calendar projection/appointments expose responsible member color.
- **SCHEMA_CHANGE:** YES · **MIGRATION:** YES
- **FRONTEND BATTERY BLOCKED:** F8 (Calendar member colors/filter), F9 (Team color).
- **TESTS REQUIRED:** member color persist/validate; appears in team + calendar responses; authz.

### BP3 — Appointment Responsible Member
- **WHY:** Figma 09 Calendar appointment CRUD has `Responsável` (responsible member) with member color.
- **EXACT CONTRACT:** add `Appointment.responsibleMemberId String?` → `User` relation. `create/updateAppointment` accept + validate responsible member ∈ company; list/detail/calendar responses include `responsible { id, name, color }`.
- **SCHEMA_CHANGE:** YES · **MIGRATION:** YES
- **FRONTEND BATTERY BLOCKED:** F8 (Appointment CRUD).
- **TESTS REQUIRED:** responsible member assign/update/validate; appears in calendar; existing A1 tests stay green.

### BP4 — Access Recovery (forgot / reset password)
- **WHY:** Figma 05 has Recovery + Reset Password pages; backend has no forgot/reset routes.
- **EXACT CONTRACT:** `POST /api/auth/forgot-password { email }` → creates expiring 256-bit reset token (sha256 at rest, like Invitation/Approval), delivers reset link via email; `POST /api/auth/reset-password { token, newPassword }` → one-time, validates token, sets new password, revokes sessions. **External dependency: email delivery provider (none present)** — BP4 is gated on that decision.
- **SCHEMA_CHANGE:** YES (PasswordResetToken) · **MIGRATION:** YES
- **FRONTEND BATTERY BLOCKED:** F4A recovery/reset screens.
- **TESTS REQUIRED:** token one-time/expiry/hash-at-rest; password strength; session invalidation.

**Not created (deliberately):** notifications settings (no contract), Google Drive integration (not implemented), performance pagination (moved to cleanup, not a foundation prerequisite).

## 5. Frontend battery plan (final order)

Order honors prerequisites while avoiding backend-first blocking: F1–F3 need no BP; BP1 must precede F4B/F11B; BP2+BP3 before F8; BP4 before F4A recovery screens.

- **F1** — Semantic Foundations + Theme Runtime (no BP; local default AURA/LIGHT, hydrate from workspace.appearance when BP1 lands)
- **F2** — Theme-Aware Component System (03.1–03.18)
- **F3** — App Shell + Responsive Navigation (04, 90)
- **F4A** — Access & Recovery (05) — *recovery screens blocked by BP4 (email); first-access/forced-change supported already*
- **F4B** — Guided Onboarding (05) — **blocked by BP1** (Appearance step persists)
- **F5** — Dashboard by Template (06)
- **F6A** — Clients List (07) · **F6B** — Client Detail & CRUD (07.1)
- **F7A** — Jobs Operational Views (08, Quadro/Lista/grouping) · **F7B** — Job Detail + Files + Activity (08.1)
- **F8** — Calendar + Appointment CRUD (09) — **blocked by BP2 + BP3**
- **F9** — Team (10) — **blocked by BP2**
- **F10** — Approval Queue + Public Approval (11)
- **F11A** — Settings Core (12) · **F11B** — Appearance / Theme Selector (12.1) — **blocked by BP1** · **F11C** — Integrations & WhatsApp (12.2)
- **F12** — Theme Coverage Regression (12.3)
- **F13** — Screen States + Accessibility + Responsive QA (13, 90)
- **F14** — Staging E2E + Visual Acceptance

Battery contracts (NAME/GOAL/FIGMA AUTHORITY/IN_SCOPE/OUT_OF_SCOPE/BACKEND DEPS/REUSE/VISUAL/FUNCTIONAL/MOBILE/TEST GATES) are defined concisely in §8.

## 6. Theme architecture freeze

```
WorkspaceAppearance { preset: AURA|FLUX|PULSE|CUSTOM, mode: LIGHT|DARK, customColors?: [≤6 hex] }
        ↓  (server authority, BP1)
resolveTheme(appearance) → semantic roles
        ↓
CSS custom properties on <html data-theme="aura-light"> :root
        ↓
components consume roles (no preset logic)
        ↓
screens consume components/semantic classes (no preset logic)
```

- **Semantic roles (keep `--looply-*` convention):** `--looply-bg-canvas`, `--looply-bg-surface`, `--looply-bg-subtle`, `--looply-text-primary`, `--looply-text-secondary`, `--looply-text-muted`, `--looply-border-default`, `--looply-action-primary`, `--looply-action-primary-hover`, `--looply-status-*`; plus current tokens as base. Screens never branch on Aura/Flux/Pulse.
- **PRESET AUTHORITY:** server (`Company.appearancePreset`), default AURA (Notion product contract).
- **MODE AUTHORITY:** server (`appearanceMode`), default LIGHT. No per-user mode in V1.
- **CUSTOM COLOR AUTHORITY:** server (`appearanceCustomColors`, ≤6 hex, validated). Derivation (palette → roles) happens centrally in `resolveTheme()`.
- **HYDRATION SOURCE:** `workspace.appearance` from `/api/auth/me` (BP1); before BP1, `resolveTheme()` uses the default AURA/LIGHT — the app is fully functional with no backend.
- **FALLBACK:** static AURA/LIGHT token set in `index.css` `:root` — the app renders correctly with no runtime.
- **SSR/FOUC:** Vite SPA, no SSR. Resolve + set `data-theme` on `<html>` synchronously in `main.tsx` before `createRoot` render; tokens live in one stylesheet so there is no post-paint theme flash.
- **ACCESSIBILITY/CONTRAST:** derive contrast-safe roles; coral `#F06D55` on cream passes AA; custom colors validated server-side (hex only — never interpolate raw strings into CSS); dark mode maintains the same contrast floor. WCAG AA for text/action pairs.

## 7. Template architecture freeze

Runtime = `workspaceTemplate` (existing enum, NOT duplicated) + `capabilities` (existing registry) + **frontend presentation defaults** (new, code-only, keyed by template).

- **navigation configuration:** per-template sidebar items (marketing: full set incl. Aprovações/Agenda/Equipe; local-business: minimal)
- **Dashboard module composition:** template decides which modules render (marketing: Jobs ativos, Em aprovação, Vencem hoje, Clientes ativos, Atenção agora, Agenda de hoje, Atividade recente)
- **Jobs default mode:** marketing → Quadro (stage grouping incl. client groups like "Mova Studio"); others → Lista
- **feature visibility + labels:** driven by capabilities, never by duplicating templates
- **NO three route trees; NO duplicated Dashboard.** One route tree; presentation registry mirrors `domain/capabilities.ts` on the frontend.

## 8. Battery contracts (concise)

- **F1 Semantic Foundations + Theme Runtime** · GOAL: tokens + resolveTheme + data-theme + defaults. FIGMA: 01 Foundations, 12.1. IN: token roles, presets AURA/FLUX/PULSE + custom derivation, light/dark, FOUC-safe bootstrap. OUT: backend persistence, screen re-skins. BACKEND: none (defaults) → BP1 when available. REUSE: `index.css` vars, `tailwind.config.js`. ACCEPT: shell re-skins from token swap; contrast AA; theme applied pre-paint. GATES: FE typecheck/test/build.
- **F2 Component System** · GOAL: Figma 03.1–03.18 components consume semantic roles. IN: Button, Badge, Input, NavItem, Avatar, Card, Select, Checkbox, Toggle, Radio, Tabs, Table/Row, Pagination, Dropdown, Dialog, Toast, Tooltip, Skeleton. OUT: screens. BACKEND: none. REUSE: `components/*`. ACCEPT: theme-aware variants + states. GATES: FE.
- **F3 App Shell + Nav** · GOAL: 272px sidebar, workspace switcher, contextual primary action, top bar, mobile 390×844 bottom nav + avatar sheet (NOT stacked sidebar). FIGMA: 04, 90. BACKEND: none (WorkspaceContext exists). ACCEPT: desktop + mobile nav, capability-driven items. GATES: FE.
- **F4A Access & Recovery** · GOAL: Login, forced password change (exists), Recovery/Reset (BP4). FIGMA: 05. RECOVERY BLOCKED BY BP4+email. GATES: FE (+BE if BP4).
- **F4B Guided Onboarding** · GOAL: Welcome→Company→Profile→Template→Appearance→Ready. FIGMA: 05. BLOCKED BY BP1 for Appearance step; template/company steps usable now. GATES: FE (+BE BP1).
- **F5 Dashboard by Template** · GOAL: template module composition. FIGMA: 06, Template Experience Matrix. BACKEND: existing `/api/dashboard`. GATES: FE.
- **F6A/F6B Clients** · GOAL: list/search/filter + detail + CRUD + archive. FIGMA: 07/07.1. BACKEND: existing `/api/clients`. GATES: FE.
- **F7A/F7B Jobs** · GOAL: Quadro/Lista, search, client filter, stage+client grouping; detail + files + metadata + versions + activity + approval handoff. FIGMA: 08/08.1. BACKEND: existing `/api/jobs` (paginated). REUSE: Job/JobVersion/Approval/Activity domain. GATES: FE.
- **F8 Calendar + Appointments** · GOAL: Semana/Agenda, date nav, today, client+team filter, appointment cards/CRUD with Responsável + member color. FIGMA: 09. **BLOCKED BY BP2 + BP3.** REUSE: calendar projection (A1.2). GATES: FE + BE (BP2/BP3 tests).
- **F9 Team** · GOAL: list, role filter, invites, role/status/last activity, operational color. FIGMA: 10. **BLOCKED BY BP2.** GATES: FE + BE.
- **F10 Approval Queue + Public Approval** · GOAL: internal queue (tabs, search, client filter, version, secure indicator) + public page (preview, comment, approve, request changes). FIGMA: 11. BACKEND: existing approval security (A). GATES: FE.
- **F11A/B/C Settings** · GOAL: core + Appearance (12.1, BP1) + Integrations (12.2). FIGMA: 12/12.1/12.2. **F11B BLOCKED BY BP1.** Integrations render truthful state (Task 9). GATES: FE + BE (BP1).
- **F12 Theme Coverage Regression** · GOAL: theme correctness across shell/nav/forms/cards/tables/jobs/calendar/team/approvals/settings/states/mobile/dialogs/feedback — semantic, not per-screen overrides. FIGMA: 12.3. GATES: FE.
- **F13 Screen States + A11y + Responsive QA** · GOAL: Empty/Loading/Error (desktop+mobile), a11y, mobile pass. FIGMA: 13, 90. GATES: FE.
- **F14 Staging E2E + Visual Acceptance** · GOAL: end-to-end on staging + visual QA against Figma. GATES: full suite.

## 9. Integrations state model (truthful)

Semantic states (project naming): `NOT_AVAILABLE` · `AVAILABLE_NOT_CONFIGURED` · `CONFIGURATION_REQUIRED` · `CONNECTED` · `DEGRADED` · `ERROR`.

| Integration | Backend reality | State |
|---|---|---|
| Meta direct (`whatsapp`) | implemented; env config only, not live | `AVAILABLE_NOT_CONFIGURED` (until runtime proves CONNECTED) |
| Gupshup | implemented; no live creds/config (A3.G1 PASS) | `AVAILABLE_NOT_CONFIGURED` |
| Google Drive | not implemented (files = S3-compatible `STORAGE_*`) | `NOT_AVAILABLE` |

Authority: server-derived config/readiness state (e.g., via `/api/integrations` readiness using existing provider unconfigured detection) — the frontend NEVER infers `CONNECTED` from a feature flag or from presence of code. "implemented in code" ≠ "connected". No secrets/API keys ever reach the frontend; Gupshup API key stays server-side (`GUPSHUP_API_KEY` env).

## 10. Route migration plan

Target routes (one tree; legacy `/contents*` maps to canonical Job vocabulary):

| Target | Source/Notes |
|---|---|
| `/login` | exists |
| `/forgot-password`, `/reset-password` | NEW (BP4) |
| `/change-password` | NEW route; first-access/forced-change (backend exists) |
| `/onboarding` (+ steps) | NEW (F4B) |
| `/dashboard` | exists |
| `/clients`, `/clients/:id` | `/clients` exists; `/clients/:id` NEW (F6B) |
| `/jobs`, `/jobs/new`, `/jobs/:id` | NEW — canonical Job vocabulary replaces `/contents*` |
| `/calendar` | exists |
| `/team` | exists |
| `/approvals` | NEW internal queue (F10) |
| `/settings`, `/settings/appearance`, `/settings/integrations` | NEW (F11A/B/C) |
| `/approve/:token` | exists (public) |
| `/contents`, `/contents/new`, `/contents/:id` | legacy → **redirect** to `/jobs`, `/jobs/new`, `/jobs/:id` during F7A; drop after F14 |

Backward-compat redirects: keep legacy `/contents*` redirects through F14 (staging bookmarks), remove in the same battery that removes the legacy endpoint. No invented nested routes beyond `/onboarding/*` and `/settings/*` (both justified by Figma).

## 11. Performance triage

| Finding | Class | Rationale |
|---|---|---|
| H1 `/api/contents` unbounded | **OBSOLETE_AFTER_ROUTE_MIGRATION** (→ POST-MIGRATION CLEANUP) | canonical screen migrates to `/api/jobs` (paginated, `jobService.ts:34-73`); legacy endpoint removed/aliased in F7A cleanup |
| H2 `/api/publications` unbounded | **OBSOLETE_AFTER_ROUTE_MIGRATION** (→ POST-MIGRATION CLEANUP) | Calendar re-skin (F8) consumes `/api/calendar` (windowed) + `/api/appointments` (paginated); publications retired with legacy UI |

Neither is BLOCKING nor PRE-BATTERY. Old "BP4 bound endpoints" is **MOVE** → post-migration performance cleanup, not a theme/frontend foundation prerequisite.

## 12. Security contract (read-only reconciliation)

- **Theme:** tenant authority server-side (BP1); custom colors validated (hex allowlist, zod enum/hex, length ≤6) — **no arbitrary CSS injection** (values never interpolated raw into styles); mode/preset enum allowlist.
- **Onboarding:** first access via temporary password + `mustChangePassword`; forced change (requireAuth gate); invitations 256-bit token + sha256 at rest + single-use + expiry; role authority enforced server-side (`requireCapability`, member guards).
- **Team:** role edit OWNER/ADMIN only (existing `members.ts`); member color is validated data (hex), never CSS injection; capability enforcement server-side (unchanged).
- **Approvals:** 256-bit token; version pinning via `contentVersionId`; comments zod-validated; decision idempotency via atomic one-time status update (`approvalService.ts:130-135`) — unchanged.
- **Integrations:** no secrets to frontend; connection state only; Gupshup/Meta keys server-side (env); no API keys in any `/api/integrations` response.
- **Files:** signed/authorized access (presigned URLs, `STORAGE_PRESIGN_TTL_SECONDS`).
- **Planning acceptance:** SECURITY_CRITICAL=0, SECURITY_HIGH=0 (F0R audit). No battery is blocked by a security finding. Known MEDIUM items (team tenant-scoping, contents status PATCH bypassing workflow transitions) are carried into the relevant battery's backend work, not left as planning blockers.

## 13. Dependencies on Figma/Notion contracts (unchanged)

- Onboarding appearance presets: Aura (default), Flux, Pulse, Customizado.
- Theme persisted at workspace level, editable via Configurações → Aparência.
- No public self-signup; initial access provisioned by Verbum Lab.