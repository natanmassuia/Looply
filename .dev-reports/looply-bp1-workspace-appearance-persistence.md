# BP1 — Workspace Appearance Persistence (Execution Report)

- **Date:** 2026-08-15
- **Branch:** `feature/demo-v1-polish`
- **Initial HEAD:** `e3b34bcf325477b908de740c9b5b4e09d2443403`
- **Final HEAD (feat):** `00da9b8` — `feat(v1): persist workspace appearance`
- **Status:** `BP1 — PASS MIGRATION_APPLIED`

## Mandatory rules compliance

| Rule | Result |
|---|---|
| PREEXISTING_DIRTY_STATE_PRESERVED | YES (14 modified + 7 untracked preserved; staged only exact BP1 files) |
| UNRELATED_FILES_MODIFIED | NO |
| FRONTEND_SOURCE_MODIFIED | NO |
| DEPLOY / PUSH / RUNTIME_RESTART | NO |
| git reset/restore/clean/stash/add . /add -A | NEVER executed |

## Tasks executed

- **Task 1 — Schema:** added enums `AppearancePreset` (AURA/FLUX/PULSE/CUSTOM) + `AppearanceMode` (LIGHT/DARK) and 8 nullable `Company` appearance columns to `schema.prisma`. Nullable → deterministic default without backfill; existing rows preserved.
- **Task 2 — Migration:** `prisma migrate dev` was blocked by shadow-DB permission (`P3014`). Used the safe fallback: generated the additive SQL with `prisma migrate diff --from-schema-datasource --to-schema-datamodel`, wrote `20260822100000_workspace_appearance/migration.sql`, applied with `prisma migrate deploy` to the local dev DB (`127.0.0.1:5432/looply` — loopback, provably non-production). `migrate status` / `migrate deploy` now report up to date.
- **Task 3 — Domain:** `domain/appearance.ts` — pure vocabulary: presets, modes, six base color keys, `HEX_COLOR_RE`, `normalizeHex`, `DEFAULT_PRESET=AURA`, `DEFAULT_MODE=LIGHT`, `resolveAppearance()` (null → default; CUSTOM carries its six colors).
- **Task 4 — Service:** `services/workspaceAppearanceService.ts` — canonical `getAppearance` / `updateAppearance` owning CUSTOM invariants, transition clearing, uppercase normalization, company-scoped read/write.
- **Task 5 — Validation:** `lib/validation.ts` — `customColorsSchema` (six exact keys, `#RRGGBB` regex, `.strict()`) and `updateAppearanceSchema` (`preset`/`mode` enums optional, `.strict()` → forged tenant fields rejected).
- **Task 6 — Routes:** `routes/settings.ts` — `GET/PATCH /api/settings/appearance` mounted at `/api/settings` inside the session+password-changed+workspace-active chain; PATCH gated `requireRole("OWNER","ADMIN")`; tenant from session only.
- **Task 7 — WorkspaceContext:** `capabilities.ts` — `WorkspaceContext` gains `appearance`; `resolveWorkspaceContext` accepts appearance columns. `/api/auth/me` and `/api/dashboard` company selects extended (no extra query).
- **Task 8 — Onboarding (F4B deferred):** onboarding `PATCH /company` unchanged; F4B will call the same canonical `updateAppearance` service — proven by service-contract tests 36–40. Choice documented in `docs/engineering/21` §7.
- **Task 9 — Tests:** `tests/workspaceAppearance.test.ts` — 42 tests (defaults 1–5, presets 6–11, custom colors 12–21, transitions 22–27, HTTP contract incl. tenant/auth 28–35, F4B service contract 36–40, customColors-with-non-CUSTOM). HTTP cases use the local dev DB and restore the demo workspace to default in `afterAll`.
- **Task 10 — Docs:** `docs/engineering/21-workspace-appearance-persistence.md` + this report.
- **Task 11 — Git:** staged exact BP1 files only; `git diff --cached --check` clean; commit `feat(v1): persist workspace appearance`.

## Validation gates

- Backend: typecheck PASS · **378 tests passing** (336 baseline + 42 new) · build PASS · prisma:validate PASS
- Frontend: typecheck PASS · **32 tests passing** · build PASS (no frontend source changes)

## Migration status

| Item | Result |
|---|---|
| Migration | `20260822100000_workspace_appearance` (additive: 2 enums + 8 Company columns) |
| Shadow DB | NOT available (P3014 — app user cannot `CREATE DATABASE`); used `migrate diff` + `migrate deploy` instead |
| Target | local dev DB `127.0.0.1:5432/looply` (loopback, provably non-production) |
| Applied | YES — `migrate deploy` reports all 11 migrations applied, no pending |

## Security audit (CRITICAL=0, HIGH=0)

| Finding | Verdict |
|---|---|
| Tenant spoofing via body `companyId` | MITIGATED — session tenant only; `.strict()` rejects forged keys (HTTP tests 34/35) |
| CSS / theme injection (var(), url(), rgba(), hsl(), gradients) | MITIGATED — hex-only regex + uppercase normalization; backend never emits CSS |
| Mass assignment / unknown keys (incl. `__proto__`) | MITIGATED — `.strict()` + explicit service `data` object |
| Authz | Read = any active member; write = OWNER/ADMIN |
| Secrets / payload size | No new secrets; express JSON `1mb` limit; color strings fixed 7 chars |
| Residual (LOW) | No rate limit on PATCH (consistent with other write endpoints); `resolveAppearance` uses `""` fallback if a CUSTOM row were ever left incomplete by manual DB edit |

## Performance notes

- No N+1: appearance read/write = 1 `findUnique` (+ 1 `update`), single tenant.
- No unbounded queries, no new dependencies, no cache needed (single-row, per-company).
- `/me` + `/dashboard` selects add 8 scalar columns to an existing single-row fetch — negligible.
- No new indexed columns (no filtered/joined appearance columns).

## NOTION_UPDATE_PAYLOAD

```
STATUS: BP1 — PASS MIGRATION_APPLIED
BRANCH: feature/demo-v1-polish
COMMIT: 00da9b8 feat(v1): persist workspace appearance
CONTRACT: Company.appearancePreset/Mode + 6 custom color columns (additive, nullable);
  GET/PATCH /api/settings/appearance (PATCH OWNER/ADMIN); WorkspaceContext.appearance via /api/auth/me
  and /api/dashboard; defaults AURA/LIGHT/null; six base colors primary/secondary/accent/surface/text/border,
  #RRGGBB uppercase, strict zod (forged tenant keys rejected)
ONBOARDING: PATCH /company unchanged; F4B calls the same canonical updateAppearance service (service-contract tests 36-40)
MIGRATION: 20260822100000_workspace_appearance applied to local dev DB (127.0.0.1:5432/looply);
  shadow DB unavailable (P3014) -> migrate diff + migrate deploy
GATES: backend 378 tests (336+42) / frontend 32 tests; typecheck+build+prisma:validate PASS
SECURITY: CRITICAL=0 HIGH=0
NEXT_BATTERY: F1 Semantic+Theme Runtime (no BP) — can start immediately; consumes workspace.appearance for F4B/F11B/F12
```

## F1 readiness

`/api/auth/me` now returns `workspace.appearance` (fallback AURA/LIGHT). F1's local default equals the service default, so F1 can proceed immediately; F4B/F11B/F12 will consume the persisted value.