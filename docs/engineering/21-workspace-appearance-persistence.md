# 21. Workspace Appearance Persistence (BP1)

Status: **IMPLEMENTED — BP1 PASS MIGRATION_APPLIED** (local dev DB at `127.0.0.1:5432/looply`).

Part of the Frontend Migration Final Plan (`docs/engineering/20`). Theme is a **persisted workspace product contract** (Figma 12.1 Theme Selector + onboarding Appearance step). This battery adds the smallest canonical backend to store the workspace's appearance choice. The backend stores the choice only — **no theme derivation, no CSS emission server-side**. Theme resolution stays on the frontend (F1 Semantic+Theme runtime, `resolveTheme()`).

## 1. Overview

| Item | Decision |
|---|---|
| Storage | Six nullable `Company` scalar columns + two enums (additive, no backfill) |
| Contract surface | `GET/PATCH /api/settings/appearance` |
| WorkspaceContext | Extended with `appearance`; exposed via `/api/auth/me` and `/api/dashboard` |
| Onboarding (F4B) | Deferred; F4B calls the same canonical `updateAppearance` service |
| Frontend source | Untouched in this battery (regression only) |

## 2. Exact contract

```ts
appearance: {
  preset: "AURA" | "FLUX" | "PULSE" | "CUSTOM";
  mode: "LIGHT" | "DARK";
  customColors: {
    primary: string; secondary: string; accent: string;
    surface: string; text: string; border: string;
  } | null;
}
```

- **Six base colors (stable V1 contract):** `primary, secondary, accent, surface, text, border`. Exact six keys; no arbitrary extra keys.
- **Color values:** `#RRGGBB` hex only, stored uppercase. Rejects `#RGB`, `var()`, `url()`, `rgba()`, `hsl()`, gradients.
- **Default (deterministic, no backfill):** `AURA` / `LIGHT` / `customColors: null`. Applies to every existing/onboarding row with null columns.
- **PATCH is partial:** any of `preset | mode | customColors` may be sent; omitted fields are preserved.

## 3. Schema (additive migration)

`backend/prisma/migrations/20260822100000_workspace_appearance/migration.sql`:

```sql
CREATE TYPE "AppearancePreset" AS ENUM ('AURA','FLUX','PULSE','CUSTOM');
CREATE TYPE "AppearanceMode" AS ENUM ('LIGHT','DARK');
ALTER TABLE "Company"
  ADD COLUMN "appearancePreset" "AppearancePreset",
  ADD COLUMN "appearanceMode" "AppearanceMode",
  ADD COLUMN "appearanceCustomPrimary" TEXT,
  ADD COLUMN "appearanceCustomSecondary" TEXT,
  ADD COLUMN "appearanceCustomAccent" TEXT,
  ADD COLUMN "appearanceCustomSurface" TEXT,
  ADD COLUMN "appearanceCustomText" TEXT,
  ADD COLUMN "appearanceCustomBorder" TEXT;
```

Columns are nullable → existing rows resolve to the deterministic default without a destructive reset or backfill. No new indexes needed (single row per company, no filtered/joined columns).

## 4. API

`backend/src/routes/settings.ts` (mounted at `/api/settings` inside the session + password-changed + workspace-active chain):

- `GET /api/settings/appearance` → `{ appearance }` — readable by any **active** workspace member (the UI needs the theme).
- `PATCH /api/settings/appearance` → `{ appearance }` — **OWNER/ADMIN only**.

Tenant is always taken from the session (`req.auth.companyId`); the request body is `zod .strict()` so any unknown key — including a forged `companyId` — is rejected with `400`.

## 5. PATCH semantics (canonical service)

`backend/src/services/workspaceAppearanceService.ts` owns all invariants (`updateAppearance`):

- `customColors` supplied with a non-CUSTOM resulting preset → `400`.
- `CUSTOM` resulting preset requires the **complete six** (supplied in this PATCH, or already present from a previous write) → else `400`.
- Transition `CUSTOM → non-CUSTOM` **deterministically clears** the stored colors.
- Hex values are normalized to uppercase on write (single authority).
- Read/write are scoped to the given `companyId`; the route only ever passes the session's company.

## 6. WorkspaceContext exposure

`backend/src/domain/capabilities.ts` — `WorkspaceContext` gains `appearance: WorkspaceAppearance`; `resolveWorkspaceContext` accepts the appearance columns (`Partial<AppearanceColumns>`) and resolves via the pure `resolveAppearance()` from `domain/appearance.ts`. Callers:

- `routes/auth.ts` `/me` — company select extended with the appearance columns (fallback AURA/LIGHT).
- `services/dashboardService.ts` — company select extended (no extra query).

`domain/appearance.ts` holds the pure vocabulary: enums, the six keys, `HEX_COLOR_RE`, `normalizeHex`, `resolveAppearance` (null → deterministic default), `DEFAULT_PRESET = AURA`, `DEFAULT_MODE = LIGHT`.

## 7. Onboarding integration (F4B — intentionally deferred)

The onboarding `PATCH /company` endpoint is **unchanged** (stays company-info only). F4B's onboarding Appearance step will call the **same canonical** `updateAppearance` service — proven by service-contract tests 36–40 in `tests/workspaceAppearance.test.ts` (works for unconfigured workspaces with no template, same CUSTOM invariants, deterministic default, company-scoped, deterministic round-trip). Choice documented here and in the BP1 report.

## 8. Security

- Tenant isolation: session-derived company only; body `companyId` rejected (strict) — HTTP tests 34/35.
- No CSS/theme injection: hex-only regex + uppercase normalization; backend never emits CSS from DB.
- Mass assignment: explicit service `data` object; strict zod rejects unknown keys (`__proto__`, extra color keys, etc.).
- Authz: read = any active member (workspace-active chain), write = OWNER/ADMIN.
- No new secrets, no new deps, error mapping reuses existing `AppError`/`errorHandler` (no internal leakage).

## 9. Tests

`backend/tests/workspaceAppearance.test.ts` — 42 tests: defaults (1–5), presets (6–11), custom colors (12–21), transitions (22–27), HTTP contract incl. tenant/auth (28–35), F4B service contract (36–40) + customColors-with-non-CUSTOM rejection. HTTP cases run against the local dev DB (`describe.skipIf(!DATABASE_URL)`) and restore the demo workspace to default in `afterAll`.

## 10. Validation gates

- Backend: typecheck PASS · **378 tests passing** (336 baseline + 42 new) · build PASS · prisma:validate PASS.
- Frontend: typecheck PASS · **32 tests passing** · build PASS (no frontend source changes).

## 11. Migration status

`20260822100000_workspace_appearance` **applied** to the local dev DB at `127.0.0.1:5432/looply` (loopback, provably non-production). `prisma migrate deploy` reports no pending migrations.

## 12. F1 readiness

`/api/auth/me` now returns `workspace.appearance`; F1's local default (AURA/LIGHT) equals the service default, so F1 can start immediately with no dependency on this battery — but F4B/F11B/F12 consume the persisted value.

## 13. References

- `docs/engineering/20-frontend-migration-final-plan.md` (BP1 definition, §4).
- `docs/engineering/19-figma-frontend-contract-freeze.md` (historical; unchanged).
- `.dev-reports/looply-bp1-workspace-appearance-persistence.md` (execution report).