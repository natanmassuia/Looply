# 19. Figma Frontend Contract Freeze (F0R)

Status: **BLOCKED — FIGMA_ACCESS_REQUIRED** (repo-side audit complete; live Figma inspection impossible: no MCP/CLI/token, web + REST API both return 403). This document **freezes the current repo-side frontend contract** as the authoritative baseline for the F1+ batteries. Every FIGMA column is marked `UNVERIFIED` — nothing in this file is a claim about the live Figma file.

Follows [00. V1 Refactor Baseline](./00-v1-refactor-baseline.md) and [01. Target Architecture](./01-target-architecture.md). Companion execution report: `.dev-reports/looply-f0r-figma-frontend-contract-freeze.md`.

## 1. Freeze scope

Freezing **today's committed frontend contract** on `feature/demo-v1-polish` (HEAD `d58eebbb`), plus the backend contracts the frontend depends on. The freeze is read-only: no source changed, no routes altered, no theme runtime added.

Canonical Figma file (target): `https://www.figma.com/design/8JDixNLJNe1f3KVPRwEFBi/Looply-%E2%80%94-Brand---Product` — **not inspected** (403 on web and API).

## 2. Frozen theme contract (repo-side, `frontend/src/index.css`)

Single light theme, static CSS custom properties, no runtime switching:

- Surfaces (zinc, light): `--looply-background #f4f5f7`, `--looply-surface #ffffff`, `--looply-surface-muted #f0f1f4`, `--looply-surface-subtle #f7f8fa`.
- Borders: `--looply-border #e2e4e9`, `--looply-border-strong #c8ccd4`, `--looply-border-subtle #eaecf0`.
- Text (charcoal/navy): `--looply-foreground #1a1d26`, `--looply-muted-foreground #5f6577`, `--looply-faint-foreground #9498a8`, `--looply-tertiary-foreground #b0b4c0`.
- Brand (restrained blue): `--looply-primary #2563eb`, hover `#1d4ed8`, active `#1e40af`, subtle `#eff4ff`, soft `#dbe4ff`.
- Semantic (10% bg / 20% border / 100% text): success `#059669`, warning `#d97706`, danger `#dc2626`, information `#2563eb`, each with `-bg` and `-border` variants.
- Shape: radius `--looply-radius-sm 6px`, `--looply-radius 8px`, `--looply-radius-md 10px`, `--looply-radius-lg 12px`, `--looply-radius-xl 16px`, `--looply-btn-radius 10px`; buttons render `border-radius: 9999px` (pill) per `.btn*` classes.
- Shadows: `--looply-shadow-sm/-/-md/-lg` (near-invisible, selective).
- Typeface: **Inter** (`body { font-family: "Inter", ... }`), features `cv11`/`ss01`.
- `tailwind.config.js` mirrors the tokens as Tailwind palette (`brand.*` 50–900, `sidebar.*`, `surface.*`, `looply` radii/shadows, `Inter` sans).

### Theme runtime verdict

| Question | Answer |
|---|---|
| THEME_RUNTIME_EXISTS | **NO** — static `:root` tokens only; no runtime theming |
| THEME_PERSISTENCE_EXISTS | **NO** — `lib/store.ts` holds only `sidebarCollapsed`; no `persist`, no localStorage theme |
| CUSTOM_6_COLOR_SUPPORT | **NO** — brand is a fixed blue scale; no palette picker, no dynamic CSS var mutation |
| LIGHT_DARK_SUPPORT | **NO** — no `dark:` strategy, no class-based theming, no `prefers-color-scheme` handling |
| THEME_CONTRACT_BLOCKER | **YES** — landing a Figma theme (per design brief: Manrope / warm coral `#F06D55` / `#FFF7F1` canvas — UNVERIFIED against live Figma) requires a theme runtime that does not exist |

### Hardcoded color audit (5 hits, all minor)

| Location | Literal | Class |
|---|---|---|
| `features/Clients.tsx:14` | `#2563eb` (brandColor default) | BRAND_TOKEN (duplicates `--looply-primary`) |
| `features/Clients.tsx:128` | `#475569` fallback | LOCAL_HARDCODE (data fallback) |
| `features/Calendar.tsx:128` | `#475569` fallback | LOCAL_HARDCODE (data fallback) |
| `features/PublicApproval.tsx:57` | `from-[#f8f9fb] to-white` gradient | LOCAL_HARDCODE (approval page background) |
| `features/PublicApproval.tsx:62` | `#0f172a` fallback | LOCAL_HARDCODE (data fallback) |

`index.css` hex literals inside `:root` are the token **source**, not drift (SAFE_SEMANTIC). Per-client `brandColor` is user data, not a theme token. No NEEDS_REFACTOR findings.

## 3. Frozen component contract (repo-side)

- **Routes** (`App.tsx`): `/login`; guarded `ProtectedRoute > AppLayout` for `/dashboard`, `/contents`, `/contents/new`, `/contents/:id`, `/calendar`, `/clients`, `/team`; public `/approve/:token` (PublicApproval). **Not wired:** `/onboarding`, `/change-password` (constants exist in `lib/workspace.ts`, routes absent).
- **Components**: `AppLayout`, `Sidebar` (light palette, active bar), `Breadcrumb`, `Icons` (local SVG set), `StatusPill`, `common` (`Card`, `Modal`, `EmptyState`, `Loading`, `ConfirmDialog`).
- **Features**: Dashboard, ContentsList (kanban, drag-and-drop grouping), ContentDetail, NewContent, Calendar (month grid, `buildMonthGrid` memoized), Clients, Team, Login, PublicApproval.
- **Data layer**: TanStack Query (staleTime 15s, `refetchOnWindowFocus: false`, mutations `retry: false`); minimal zustand UI store; `lib/api.ts` typed client; `lib/workspace.ts` capability helpers.
- **XSS surface**: none — no `dangerouslySetInnerHTML`/`innerHTML`; `mediaUrl` only in `<img src>`.
- **Responsive**: only `sm:` (20) and `lg:` (12) breakpoints across the app; no `md:`/`xl:`/`2xl:`; desktop-first.

## 4. Frozen capability / template contract (repo-side)

- Backend `Company.workspaceTemplate` exists: enum `WorkspaceTemplate { LOCAL_BUSINESS, HIGH_TICKET, MARKETING_AGENCY }` (`prisma/schema.prisma:34-38,143`), authoritative registry in `domain/capabilities.ts` (`TEMPLATE_REGISTRY`, `capabilitiesForTemplate`); null template → zero capabilities; `WorkspaceContext { id, name, template, capabilities, status UNCONFIGURED | ACTIVE }` served via `GET /api/auth/me`.
- Frontend consumes it **only** through `lib/workspace.ts` (`hasCapability`, `isWorkspaceActive`, `getPostLoginDestination`). No template-specific screens, no `/onboarding` route, no capability-driven nav rendering beyond sidebar.
- **TEMPLATE_RUNTIME_READY = PARTIAL** — backend contract is ready and capability helpers exist, but the onboarding gate UI and template-aware frontend are not implemented.

## 5. Frozen approval contract (repo-side)

- Public approval token: `randomBytes(32).toString("hex")` (256-bit) — `lib/token.ts:5-7`; stored only as SHA-256 — `services/approvalService.ts:16,56`; 7-day TTL; one-time via atomic `updateMany({ where: { status: "PENDING" } })` — `approvalService.ts:130-135`.
- Frontend route `/approve/:token` renders approve/request-changes actions. Backend is authoritative; no auth session required (token-gated).
- **BACKEND_SUPPORT = SUPPORTED.**

## 6. Contract matrix (F0R — repo-side classification)

FIGMA_CONTRACT column is `UNVERIFIED` (file inaccessible). Repo classification legend: **A** fully implemented + contract-matching; **B** implemented, drift unknown; **C** implemented, known contradiction; **D** missing/not implemented; **E** backend-only; **F** out of scope/deferred.

| Contract | FIGMA_CONTRACT | REPO_CURRENT_STATE | Class |
|---|---|---|---|
| COLOR_CONTRACT | UNVERIFIED | Blue `#2563eb` brand + zinc neutrals + semantic set (tokenized) | B |
| TYPOGRAPHY_CONTRACT | UNVERIFIED | Inter, `cv11`/`ss01`; brief hints Manrope — contradicts, UNVERIFIED | C |
| RADIUS_CONTRACT | UNVERIFIED | 6/8/10/12/16 tokens; buttons pill 9999px | B |
| SHADOW_CONTRACT | UNVERIFIED | `--looply-shadow-sm/-/-md/-lg` near-invisible | B |
| BUTTON_CONTRACT | UNVERIFIED | `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-danger`, pill, sizes | B |
| STATUS_PILL_CONTRACT | UNVERIFIED | `.status-pill` + `StatusPill` (semantic tints) | B |
| CALENDAR_CONTRACT | UNVERIFIED | Month grid, `[from,to)` projection, memoized | B |
| APPROVAL_CONTRACT | UNVERIFIED | `/approve/:token`, 256-bit token, one-time, 7d TTL | A |
| TEMPLATE_RUNTIME_CONTRACT | UNVERIFIED | Backend registry ready; frontend capability helpers only; no onboarding UI | D |
| THEME_CONTRACT | UNVERIFIED | Static light theme; NO runtime, NO persistence, NO light/dark, NO custom colors | D |

### CLASSIFICATION_COUNTS

- A (fully implemented + matching): **1** (APPROVAL_CONTRACT)
- B (implemented, drift unknown): **6** (COLOR, RADIUS, SHADOW, BUTTON, STATUS_PILL, CALENDAR)
- C (implemented, known contradiction): **1** (TYPOGRAPHY — brief-based, Figma UNVERIFIED)
- D (missing/not implemented): **2** (TEMPLATE_RUNTIME, THEME runtime)
- E (backend-only): **0**
- F (out of scope): **0**

### Truthful-state summary

- **RESPONSIVE_UI_TRUTHFUL_STATE = TRUE** — app renders correctly at desktop; minimal `sm:`/`lg:` breakpoints only (no mobile/tablet targets in scope for Demo V1).
- **THEME_UI_TRUTHFUL_STATE = TRUE** — the UI truthfully reflects the frozen static light theme; there is no theme selector making claims the theme engine cannot honor.
- **TEMPLATE_UI_TRUTHFUL_STATE = PARTIAL** — capability helpers exist and are truthful; onboarding gate UI and template-specific screens are absent (F3/F4 scope).

### Backend support

- **THEME_BACKEND_SUPPORT = NOT_SUPPORTED** — `Company` has no theme/appearance/settings columns (schema has only id/name/slug/workspaceTemplate/isActive/legalName/document/email/phone/website/timezone/locale/onboardedAt/createdAt/updatedAt).
- **TEMPLATE_BACKEND_SUPPORT = SUPPORTED** — `workspaceTemplate` + `capabilitiesForTemplate` + `WorkspaceContext` via `/api/auth/me`.
- **APPROVAL_BACKEND_SUPPORT = SUPPORTED** — token/expiry/one-time/hash-at-rest all present.

## 7. Battery plan (frozen for F1+)

**BACKEND_PREREQUISITES (before F11/F12):** BP1 — add `Company` theme columns (brand palette, canvas, radius scale, font, plus light/dark) + migration + `GET/PATCH` theme API; BP2 — surface theme in `WorkspaceContext` via `/api/auth/me`; BP3 — theme persistence write path with zod validation. BP4 (ties to F1) — paginate/bound `/api/contents` and `/api/publications` (performance H1/H2).

**FINAL_BATTERY_SEQUENCE (each gated on Figma access + prior battery):**

- **F1** — Figma contract inventory (page-by-page extraction; blocks F2–F14 until delivered).
- **F2** — Frontend inventory (DONE in F0R Phase 2; refresh as repo moves).
- **F3** — Route + screen wiring (`/onboarding`, `/change-password`, capability nav).
- **F4** — Theme engine: `:root` tokens → runtime theme + `data-theme`; persistence via zustand `persist`.
- **F5** — Color system implementation per Figma palette (re-skin tokens; remove hardcoded fallbacks).
- **F6** — Typography system implementation (font swap, scale, features).
- **F7** — Radius/shadow/spacing system alignment.
- **F8** — Component library alignment (buttons, pills, inputs, cards, modal, table, form fields).
- **F9** — Calendar screen re-skin.
- **F10** — Approval screen re-skin.
- **F11** — Light/dark mode runtime (needs BP1/BP2).
- **F12** — Custom 6-color brand runtime (palette picker → CSS var mutation; needs BP1–BP3).
- **F13** — Responsive layout pass (mobile/tablet).
- **F14** — Final visual QA against Figma + acceptance (blocks F0R-PASS).

## 8. Open items

- Live Figma access (token with read scope, or Figma MCP, or CLI) for file `8JDixNLJNe1f3KVPRwEFBi` — hard blocker.
- Typography contradiction (Inter vs Manrope) requires Figma verification.
- Theme runtime + `Company.theme` schema are required before any Figma theming battery can land.