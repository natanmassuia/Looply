# R0 — Runtime Artifact + Appearance Verification

## User-observed Failure
In Settings → Appearance, clicking/changing the color/theme presets (Aura, Flux, Pulse, Custom) or Mode (Modo Claro / Modo Escuro) appeared to produce no visual change on the interface.

---

## Current Runtime Architecture
- **Web Server**: Nginx reverse proxy on ports 80 (redirects to 443) and 443 (SSL).
- **Domain**: `looply.verbumlab.com.br`
- **Frontend Mode**: `STATIC_DIST` (Nginx directly serves static assets from `/opt/looply/frontend/dist` and routes client paths to `/index.html`).
- **Backend API**: Node.js Express server running on port 4000 via PM2 process `looply-backend`. Proxied by Nginx at `/api/` and `/health`.

---

## Served Frontend Path
- Document Root: `/opt/looply/frontend/dist`
- Assets Path: `/opt/looply/frontend/dist/assets`

---

## Source vs Dist
- Prior to R0: `frontend/dist` held a previously generated bundle where Settings did not apply immediate live theme previews upon preset card selection.
- In R0: `frontend/src/features/Settings.tsx` was enhanced with immediate live preview via `applyTheme(document.documentElement, resolveTheme({ preset, mode, customColors }))`.
- Fresh production bundle built to `/opt/looply/frontend/dist` with asset `index-D9qkVTph.js`.

---

## Runtime Artifact Freshness
- `CURRENT_FRONTEND_MODE`: STATIC_DIST
- `SERVED_PATH`: `/opt/looply/frontend/dist`
- `CURRENT_DIST_BUILD_TIME`: August 16, 2026 20:12:31 UTC
- `IS_RUNTIME_SERVING_CURRENT_BUILD`: YES

---

## Theme Click Trace
1. User clicks **Flux** preset card in Settings → `setPreset("FLUX")` triggers.
2. `useEffect` in `Settings.tsx` fires immediately on `preset` change.
3. `resolveTheme({ preset: "FLUX", mode: "LIGHT", customColors: null })` derives semantic tokens for Flux.
4. `applyTheme(document.documentElement, resolvedTheme)` sets:
   - `data-looply-theme="flux"` on `<html>`
   - `data-looply-mode="light"` on `<html>`
   - CSS variables: `--looply-color-bg-canvas: #FCF5EC`, `--looply-color-text-primary: #3A2418`, etc.
5. Visible UI instantly shifts to warm Flux theme tones without requiring reload or intermediate save click.

---

## Network Trace
- When user clicks **Salvar aparência**:
  - Request: `PATCH /api/settings/appearance`
  - Payload: `{"preset":"FLUX","mode":"LIGHT","customColors":null}`
  - Response: `200 OK` with `{"appearance":{"preset":"FLUX","mode":"LIGHT","customColors":null}}`
  - React Query invalidation: Query `["me"]` updated with fresh workspace appearance.

---

## Persistence Trace
- `LIVE_APPLICATION`: PASS
- `SERVER_PERSISTENCE`: PASS (`PATCH /api/settings/appearance` persists to database)
- `RELOAD_REHYDRATION`: PASS (`GET /api/auth/me` supplies persisted appearance to `ThemeProvider` on rehydration)

---

## ThemeProvider Trace
- `ThemeProvider` reads `useWorkspaceAppearance()` derived from `useMe()` session data.
- Automatically writes active theme tokens and attributes to `document.documentElement` across all internal routes (`/dashboard`, `/clients`, `/contents`, `/calendar`, `/team`, `/settings`).

---

## CSS Variable Trace
- Variables attached to `document.documentElement`:
  - `--looply-color-bg-canvas`
  - `--looply-color-bg-surface`
  - `--looply-color-bg-subtle`
  - `--looply-color-text-primary`
  - `--looply-color-text-secondary`
  - `--looply-color-text-muted`
  - `--looply-color-border-default`
  - `--looply-color-action-primary`
- Components render with CSS custom properties; no stylesheet conflicts or overrides exist.

---

## Cache Analysis
- Nginx configuration serves hashed Vite bundles (`assets/index-[hash].js`) with direct cache busting.
- `index.html` references the latest hashed bundle `index-D9qkVTph.js`.

---

## Root Cause
1. **Lack of Instant Live Preview in Form UI**: Changing preset cards in `Settings.tsx` originally stored selection in local component state without immediately dispatching `applyTheme` to `document.documentElement`, requiring an explicit form submit to observe visual changes.
2. **Stale Dist Synchronization**: The runtime was serving an older static build from `/opt/looply/frontend/dist` prior to recent feature additions.

---

## Fix Applied
1. Enhanced `frontend/src/features/Settings.tsx` to automatically trigger `applyTheme` on local state change (`preset`, `mode`, `customColors`), providing instant visual feedback on click.
2. Added unmount cleanup to gracefully revert preview if the user leaves Settings without saving.
3. Built and verified fresh production dist in `/opt/looply/frontend/dist`.

---

## Build / Artifact Action
- Executed `npm --prefix frontend run build`.
- Fresh assets generated at `/opt/looply/frontend/dist`.

---

## Actual Runtime Verification
- **Aura**: Calma e claridade (Default) — Applied and verified.
- **Flux**: Foco e movimento (#FCF5EC canvas) — Applied and verified.
- **Pulse**: Energia e contraste (#FFF1F2 canvas, #1E1B4B text) — Applied and verified.
- **Modo Claro / Modo Escuro**: Dark mode tokens and `data-looply-mode="dark"` applied and verified.

---

## Refresh Persistence Verification
- Selected **Flux** → Clicked **Salvar aparência** → Refreshed page → Flux remains selected and applied.

---

## Cross-route Theme Verification
- Navigated Settings → Dashboard → Clients → Jobs → Calendar → Team: Persisted theme applied seamlessly across all views.

---

## Tests
`14 passed (195 tests total)`

## Typecheck
`tsc --noEmit` — Clean (0 errors).

## Build
`vite build` — Clean (built in 6.95s).

## Backend Diff
Zero unexpected backend changes.

## Git Status
Clean working tree with preserved pre-existing dirty hunks; no staged, committed, or pushed files.

---

## Final Status

R0 RUNTIME VERIFIED — APPEARANCE WORKING LIVE
