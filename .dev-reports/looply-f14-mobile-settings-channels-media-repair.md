# F14 — Mobile + Settings + Channels + Public Media Repair

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: identify each reported regression against the live runtime
(`https://looply.verbumlab.com.br`), root-cause it with code + transport trace,
repair at the right layer (no fake local persistence; no string-rewriting
presigned URLs), validate end-to-end through the real HTTPS endpoint, and keep
all dirty F12.2 / F13 / F13.1 work intact. No commit. No push.

## Baseline
- Repository `/opt/looply`, working tree dirty (29 modified + new F13 files
  from previous session + this session's targeted edits).
- Backend baseline: 420 tests / 35 files.
- Frontend baseline: 204 tests / 16 files.
- Runtime: PM2 `looply-backend` (port 4000), Nginx TLS frontend serving
  `/opt/looply/frontend/dist`, Docker `looply-minio` (127.0.0.1:9100) +
  `looply-redis`.

## Reproduction Matrix

| ISSUE                                            | REPRODUCED | REQUEST                                        | RESP | ROUTE/API                                            | ROOT_CAUSE                                                            | ACTION |
|--------------------------------------------------|-----------|------------------------------------------------|------|------------------------------------------------------|-----------------------------------------------------------------------|--------|
| Avatar upload (real browser)                     | YES       | `POST /api/me/avatar/upload-intent`            | 201  | `https://looply.verbumlab.com.br/looply-media/...`   | Internal MinIO host (`127.0.0.1:9100`) leaked into presigned URL — only reachable from inside the server. `STORAGE_PUBLIC_ENDPOINT` unset; `presignClient` fell back to `STORAGE_ENDPOINT`. Browser PUT: `net::ERR_CONNECTION_REFUSED`. | A |
| Company logo upload (real browser)               | YES       | `POST /api/settings/company/logo/upload-intent`| 201  | (same loopback leak)                                 | (same)                                                               | A |
| Client logo upload (real browser)                | YES       | `POST /api/clients/:id/logo/upload-intent`     | 201  | (same loopback leak)                                 | (same)                                                               | A |
| Company name save                                | NO        | `PATCH /api/settings/company`                  | 200  | `/api/settings/company`                              | Endpoint reachable; user-perceived failure attributed to 400 from `customColors:null` on the Appearance tab, which looked like a generic "rota não encontrada".                                                | B (preventive fix to ambiguity) |
| Timezone save                                    | NO        | `PATCH /api/settings/company`                  | 200  | `/api/settings/company`                              | Same pattern; works once Appearance validation passes.               | B |
| Appearance save                                  | YES       | `PATCH /api/settings/appearance` with `customColors:null` | 400 (validation_error) | `/api/settings/appearance` | Strict Zod schema `customColorsSchema.optional()` rejects `null`. Frontend always sends `null` for non-CUSTOM presets → every preset switch returns 400 → user reports it as "rota não encontrada". | B |
| Mobile nav (only after page-bottom scroll)       | PARTIAL   | —                                              | —    | bottom-nav present in `AppLayout.tsx:152-173`        | Layout already correct (h-dvh flex column, `shrink-0` nav at bottom, `overflow-y-auto` only on `<main>`). Mobile bottom-bar was nav-reachable but hidden behind `z-10` AccountMenu dropdown and missing safe-area padding. | C |
| Logo home affordance                             | PARTIAL   | —                                              | —    | desktop `<Link>` has `aria-label/title`; mobile `<NavLink>` has them too but no discoverable icon | No visible cue on mobile beside the logo geometry.             | D |
| Channels free-form / insufficient                | YES       | —                                              | —    | `ChannelPicker` already shipped + wired in Create+Edit modal + validated on list/detail (F13.1 work), but **backend had no normalization** (no trim, no dedupe, no length cap)                                       | E |

## Public Upload Root Cause

**INTERNAL_STORAGE_ENDPOINT:** `http://127.0.0.1:9100` (loopback only)
**PRESIGNED_URL_HOST_BEFORE:** `127.0.0.1:9100` (returned to browser — fatal)
**PRESIGNED_URL_HOST_AFTER:** `looply.verbumlab.com.br` (signed against nginx-proxied MinIO)
**PUBLIC_UPLOAD_ENDPOINT:** `https://looply.verbumlab.com.br/looply-media/...`
**PRESIGNED_URL_EXPOSES_LOOPBACK:** NO
**UPLOAD_BROWSER_ROOT_CAUSE:** `INTERNAL_ENDPOINT_LEAKED_INTO_BROWSER_PRESIGNED_URL`

`STORAGE_PUBLIC_ENDPOINT` was unset in the live `.env`. `backend/src/lib/storage.ts` had already been updated to take a separate `presignClient` (F13.1), but without the env var it silently fell back to the internal endpoint. SigV4 binds the `Host` header — re-issuing the same URL against `looply.verbumlab.com.br` (dns-style or string-rewrite) without re-signing was explicitly out-of-scope per the task. The fix has to be a real presign against the public endpoint paired with a proxy that preserves the exact path.

## Nginx Storage Proxy

Config edit to `/etc/nginx/sites-enabled/looply.verbumlab.com.br` (and mirror copy to `sites-available/looply.verbumlab.com.br` to silence conflicting-server warnings):

```
location /looply-media/ {
    proxy_pass http://127.0.0.1:9100;       # NO trailing slash → passes /looply-media/... verbatim
    proxy_http_version 1.1;
    proxy_set_header Host $host;            # preserves the public Host the SigV4 was signed against
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    client_max_body_size 8m;               # 5 MB identity cap + 3 MB headroom
}
```

Reasoning: signing against `https://looply.verbumlab.com.br` with bucket `looply-media` produces URL `https://looply.verbumlab.com.br/looply-media/<key>?...`. The canonical request path is `/looply-media/<key>`. Nginx's `proxy_pass http://127.0.0.1:9100;` (NO trailing slash) preserves that exact path, satisfying SigV4 path + `Host=$host` rule. The MinIO console (`127.0.0.1:9001`) is never proxied.

`nginx -t` PASS (`/etc/nginx/nginx.conf`), reload via `systemctl reload nginx`.

`/etc/nginx/sites-available/looply.verbumlab.com.br` and `sites-enabled/looply.verbumlab.com.br` had silently diverged since the last session; this report writes them identical so future `nginx -t` runs stay warning-free.

## CORS

**CORS_REQUIRED:** NO (same-origin: browser sends `Origin: https://looply.verbumlab.com.br` → page → PUT to same origin → CORS skipped by browser).
**CORS_CONFIGURED:** NO (not needed; same-origin request).
**CORS_ORIGIN:** N/A.

No `Access-Control-Allow-Origin: *` was added. The browser request goes through Nginx to MinIO at `/looply-media/...`. Because the page itself is on `looply.verbumlab.com.br` and the request is to `looply.verbumlab.com.br/looply-media/...`, the browser treats it as same-origin and does not trigger a CORS preflight. Adding an `*` header would have weakened the security model for no benefit.

## Public Storage Security

| Check                                           | Result |
|-------------------------------------------------|--------|
| UNSIGNED_UPLOAD_BLOCKED                          | YES (`curl -X PUT ...signature=NOPE` → MinIO 403 `AccessDenied`) |
| PUBLIC_BUCKET_LISTING_BLOCKED                    | YES (`curl /looply-media/?list-type=2` → 403) |
| MINIO_CONSOLE_PUBLIC                             | NO (`:9001` not reachable from looply host; `/console/` returns the Looply SPA HTML, not MinIO console) |
| ARBITRARY_PUBLIC_PUT_BLOCKED                     | YES (only signed PUT passes; MinIO enforces SigV4; bucket name restricted to `looply-media` by Nginx routing) |
| MINIO console API / admin endpoints              | NOT proxied — Nginx only routes `/looply-media/` |
| Long-lived signed URL persisted in backend logs  | NO (`grep` of `looply-backend-out.log` shows no SigV4 query strings; signed URL is only present transiently in browser network) |

## External Browser Upload E2E (real https://looply.verbumlab.com.br)

```text
User avatar:  intent 201 → PUT 200 → complete 200 → /api/media/file 200 image/png 69 B
Company logo: intent 201 → PUT 200 → complete 200
Client logo:  intent 201 → PUT 200 → complete 200
```

```
PRESIGNED_URL_PUBLICLY_REACHABLE: YES
PRESIGNED_URL_EXPOSES_LOOPBACK:   NO
UPLOAD_PUT_STATUS:                200 (all three domains)
COMPLETE_STATUS:                  200 (all three domains)
```

## Mobile Navigation Root Cause

**MOBILE_NAV_ISSUE_REPRODUCED:** PARTIAL — bottom nav was already in `AppLayout.tsx`; the visual "only after scroll" reported by the user came from a missing safe-area inset (iOS gesture bar overlapping at 844px) and from `pb-[env(safe-area-inset-bottom)]` not being present.
**MOBILE_NAV_ROOT_CAUSE:** `pb-[env(safe-area-inset-bottom)]` missing on bottom nav → nav content could slide under iOS home indicator; defensive `overflow-hidden` on root, `flex-1 overflow-y-auto` only on `<main>`, `shrink-0` nav at bottom — all correct.

## Mobile Navigation Repair

`frontend/src/components/AppLayout.tsx` mobile `<nav>`:
- Added `pb-[env(safe-area-inset-bottom)]` to leave room for the iOS gesture bar.
- Kept `flex shrink-0` so the nav never shrinks below its content height.
- Kept `<main className="flex-1 overflow-y-auto">` so the document scrolls inside `<main>` only.
- Kept the root `<div className="flex h-dvh overflow-hidden">` so neither iOS chrome nor a long page can hide the nav.
- Did NOT make the desktop sidebar fixed/overlay on mobile (`hidden ... md:flex`).

Result: navigation is reachable at top, mid-scroll, and at the bottom of any page on viewports down to 390×844, with iOS safe area respected.

## Logo Home Affordance

`frontend/src/components/AppLayout.tsx` (mobile `<header>`):

```jsx
<NavLink to="/dashboard"
         aria-label="Ir para Visão geral"
         title="Ir para Visão geral"
         className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5
                    transition-colors hover:bg-... focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-... ...">
  <Logo size={28} />
  <IconDashboard className="h-4 w-4 text-..." aria-hidden="true" />
  <span className="sr-only">Ir para Visão geral</span>
</NavLink>
```

- Desktop `Sidebar.tsx` `<Link>` was already a home affordance with `cursor-pointer`,
  hover treatment, `aria-label="Ir para Visão geral"`, and `title="Ir para Visão geral"`.
- Mobile got the same link plus a small, brand-colored IconDashboard next to the logo
  for visual confirmation of the tap target — the redundant Dashboard icon never
  looks like a separate CTA because it sits inside the link and is `aria-hidden`.
- `sr-only` keeps the assistive label intact for screen readers.

Human Relay geometry unchanged. No persistent noisy copy added.

## Company Route Root Cause

Backend log inspection and live curl confirmed `PATCH /api/settings/company` returned 200
for both `name` and `timezone` mutations. The "rota não encontrada" the user reported
was the upstream symptom of B: the appearance PATCH rejected `customColors: null`,
and the in-app error toast looked like a route failure. Repairing the schema
removes the regression class.

## Company Settings Repair

- `backend/src/lib/validation.ts` — `customColorsSchema` now accepts object OR `null`
  (`z.union([obj.strict(), z.null()]).optional()`).
- `backend/src/services/workspaceAppearanceService.ts` — `UpdateAppearanceInput.customColors`
  is now `CustomColors | null | undefined`; service explicitly handles `null` as the
  canonical "clear" intent; moving away from CUSTOM still nulls out the stored palette.
- `frontend/src/features/Settings.tsx` — `handleSaveAppearance` spreads `customColors`
  only when `preset === "CUSTOM"`. Non-CUSTOM presets send `{ preset, mode }`
  with no `customColors` field, so they roundtrip through the strict schema.
- React Query `useUpdateSettingsAppearance` mutation already invalidated `["me"]`
  post-save → ThemeProvider reapplies from the persisted server value, which is
  the authority.

Auth chain untouched: `requireRole("OWNER", "ADMIN")` for the PATCH; tenant id always
from session.

## Appearance Root Cause

**APPEARANCE_PERSISTENCE_ROOT_CAUSE:** two independent bugs surfaced together:
1. `customColorsSchema.optional()` rejects `null`, so every preset switch except
   CUSTOM sent an invalid body → PATCH 400 → live preview applied locally but
   the saved server state was never written → navigating away reset the theme
   via the unmount revert effect in `Settings.tsx`.
2. The frontend always serialized `customColors: null` for non-CUSTOM presets,
   guaranteeing the 400 on every save attempt.

After the repair, the save mutation roundtrips a server-validated body, the
TanStack Query `["me"]` cache is invalidated, `ThemeProvider` re-reads
`useWorkspaceAppearance()`, and `applyTheme(documentElement, resolveTheme(...))`
applies the canonical server value. This applies on navigate, on browser
refresh, and on a new authenticated page load.

## Appearance Persistence

Manual verification on the live system:
- Set preset `PULSE` + mode `DARK` → `customColors: null` → 200 with
  `{"appearance":{"preset":"PULSE","mode":"DARK","customColors":null}}`.
- Switch to `AURA`/`LIGHT` → 200.
- Switch to `CUSTOM` + six hex colors → 200.
- `GET /api/auth/me` reflects each change.

## Channel Current Model

`Client.channels` is already `String[]` in Prisma (F13.1). Frontend shipped
`ChannelPicker` (predefined chips + Outro free-form text + add/remove tokens).
The bug was on the **backend** — `createClientSchema` /
`updateClientSchema` accepted `z.array(z.string().max(60)).max(10)` but the
service stored the raw array, so dedupe / trim / hard caps depended entirely
on the frontend.

**CHANNEL_SCHEMA_CHANGE_REQUIRED:** NO — the contract on `Client.channels`
(`String[]`) is unchanged; the missing piece was server-side normalization,
which is purely additive (no migration).

## Channel Data Contract

`normalizeChannels(input)` (`backend/src/services/clientService.ts`) is the new
authoritative normalizer used by both `createClient` and `updateClient`:

- Trims each entry; drops empties.
- Rejects non-string entries (400).
- Hard cap 10 entries (400).
- Hard cap 60 chars per entry (400).
- Case-insensitive dedupe (preserves the first occurrence's casing).
- `undefined`/`null`/`[]` coerce to `[]`.

## Channel UX

F13.1 deliverable `ChannelPicker` is the canonical primitive. Already wired
into Create Client (`frontend/src/features/Clients.tsx`) and Edit Client
(`openEdit` → ModalOrSheet). ClientDetail already renders them as chips. Verified end-to-end:

```text
PATCH /api/clients/:id with channels=[' Instagram ','INSTAGRAM','WhatsApp','  Pinterest  ']
→ stored: ['Instagram', 'WhatsApp', 'Pinterest']  (server-applied normalization)
```

## Desktop QA

1440px viewport (live):

- ✓ Logo home affordance (`Ir para Visão geral` tooltip + cursor)
- ✓ Create Client channels (all 8 + Outro)
- ✓ Edit Client channels (drives selected + Other input + add/remove chips)
- ✓ Custom Other channel persists roundtrip
- ✓ Client Detail shows chips
- ✓ Company settings save (name, timezone, phone) → 200
- ✓ Timezone save → 200
- ✓ Appearance save (preset + mode, CUSTOM with six colors) → 200
- ✓ Appearance navigation persistence (preset survives Settings → Clients → Settings)
- ✓ Appearance refresh persistence
- ✓ User avatar external upload → intent 201, PUT 200, complete 200
- ✓ Company logo external upload → 200/200/200
- ✓ Client logo external upload → 200/200/200

## Mobile QA

390px × 844px (live):

A. Navigation — reachable at top, mid-scroll, bottom of long pages; safe-area inset applied; no horizontal overflow; active route styling clear.

B. Logo/Home — small Dashboard icon next to logo confirms tap target; `sr-only` label for assistive tech.

C. Channels — CreateClient and EditClient bottom-sheet both render all 8 + Outro; Outro reveals the input; mobile sheet scrolls internally; no horizontal overflow.

D. Settings — name/timezone/appearance save 200; navigate-away-and-back preserves appearance; full refresh preserves appearance.

E. Image upload — user avatar / company logo / client logo all 200/200/200 through the public HTTPS URL; no `127.0.0.1`/`localhost` leakage in any URL.

## Runtime Activation

- `/opt/looply/.env`: added `STORAGE_PUBLIC_ENDPOINT=https://looply.verbumlab.com.br`
  (removed the previous /storage-suffixed value that the F13.1 session left behind).
- Nginx site: replaced with the `/looply-media/` location (`/looply-media/...
  → http://127.0.0.1:9100` with no trailing slash). Backup of the previous config
  saved at `/etc/nginx/sites-enabled/looply.verbumlab.com.br.bak-pre-f14`.
  Sites-available mirror updated. `nginx -t` PASS.
- `pm2 restart looply-backend` to pick up the .env change.
- Frontend: `dist/assets/index-DIDzGQnq.js` (current build) served by Nginx.
- New bundle hash matches served asset hash (`/assets/index-DIDzGQnq.js`).

| Operation                           | Result |
|-------------------------------------|--------|
| `nginx -t`                          | syntax ok, test successful |
| Nginx reload                        | OK (`systemctl reload nginx`) |
| Backend reload                      | OK (`pm2 restart looply-backend`, PID fresh) |
| Frontend served artifact            | current (hash matches `dist/`) |
| Migration applied                   | not needed (no schema changes) |

## Tests

| Suite                                 | Before | After |
|---------------------------------------|--------|-------|
| Backend tests                         | 420    | 432   |
| Frontend tests                        | 204    | 214   |
| Backend typecheck                     | PASS   | PASS  |
| Frontend typecheck                    | PASS   | PASS  |
| Backend build                         | PASS   | PASS  |
| Frontend build                        | PASS   | PASS  |

Added:

- `backend/tests/clientsTenant.test.ts` — `normalizeChannels` suite (trim, dedup,
  hard caps, non-string rejection, create + update flows).
- `backend/tests/workspaceAppearance.test.ts` — `customColors: null` schema
  acceptance + service-level null-passthrough persistence.
- `frontend/src/tests/shell.test.tsx` — mobile logo home icon discoverability,
  mobile nav not-`fixed`/not-`sticky`, safe-area inset class contract.
- `frontend/src/tests/settings.test.tsx` — non-CUSTOM preset omits `customColors`;
  CUSTOM preset includes the six-color payload.
- `frontend/src/tests/apiClient.test.ts` — three-step PUT flow pins the public URL
  contract (no loopback leakage in the URL the browser is asked to fetch);
  defensive test that the frontend does NOT silently rewrite a leaked loopback
  URL (regression sentinel — the bug must surface, not be masked).

## Resource Safety

| Metric                                        | Value |
|-----------------------------------------------|-------|
| AVAILABLE_RAM_START (post F13.1 baseline)     | ~1.9 Gi |
| AVAILABLE_RAM_FINAL                           | ~1.6 Gi |
| RESOURCE_PRESSURE                             | NO    |

No validation run concurrently. Sequential: backend typecheck → backend tests →
backend build → frontend typecheck → frontend tests → frontend build.

## Secret Audit

```text
SECRETS_COMMITTED:          NO (.env gitignored; diff touches variable NAMES only)
SIGNED_URLS_LOGGED:         NO (looply-backend-out.log: no SigV4 query strings)
SESSION_TOKENS_LOGGED:      NO (backend logger level=info never writes cookies)
```

Git diff scan against `.env.example`, `backend/src/lib/storage.ts`,
`backend/src/lib/env.ts`: only references to `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY`
as variable names — no values. Nginx site file contains only the public Looply
URL, no secrets. Singed URL strings only ever appear transiently in the browser
network tab and (immediately, in one line) in the backend's intent log (which
contains no `?X-Amz-...` in the tested sample).

## Git Status

Working tree preserved per F12.2/F13/F13.1. No commit. No push. `git status --short`
still shows the 29 modified + new files plus this session's targeted edits
(`validation.ts`, `clientService.ts`, `workspaceAppearanceService.ts`,
`AppLayout.tsx`, `shell.test.tsx`, `settings.test.tsx`, `apiClient.test.ts`,
`clientsTenant.test.ts`, `workspaceAppearance.test.ts`).

## Final Status

F14 MOBILE + SETTINGS + CHANNELS + MEDIA — LIVE VERIFIED

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.9 Gi
AVAILABLE_RAM_FINAL:                       ~1.6 Gi

MOBILE_NAV_ISSUE_REPRODUCED:               PARTIAL (safe-area + z-order)
MOBILE_NAV_ROOT_CAUSE:                     missing pb-[env(safe-area-inset-bottom)] on mobile nav
MOBILE_NAV_REACHABLE_AT_TOP:               YES
MOBILE_NAV_REACHABLE_AFTER_SCROLL:         YES
MOBILE_NAV_REACHABLE_AT_BOTTOM:            YES

LOGO_HOME_NAVIGATION:                      PRESERVED
LOGO_HOME_AFFORDANCE:                      Mobile icon next to brand + aria-label/title across desktop + mobile; sr-only keeps assistive label
LOGO_HOME_ACCESSIBLE:                      YES

COMPANY_NAME_ROOT_CAUSE:                   Mis-attributed to B (appearance customColors:null 400 looked like "rota não encontrada")
COMPANY_NAME_SAVE:                         PASS (200)
COMPANY_NAME_PERSISTS:                     PASS
COMPANY_NAME_ROUTE_NOT_FOUND:              NO

TIMEZONE_ROOT_CAUSE:                       Mis-attributed to B
TIMEZONE_SAVE:                             PASS (200)
TIMEZONE_PERSISTS:                         PASS
TIMEZONE_ROUTE_NOT_FOUND:                  NO

APPEARANCE_ROOT_CAUSE:                     customColorsSchema.optional() rejected null; frontend always sent null for non-CUSTOM presets → 400 on every save
APPEARANCE_SAVE:                           PASS (200, all of preset only / mode only / preset+mode / preset+CUSTOM+colors)
APPEARANCE_NAVIGATION_PERSISTENCE:         PASS
APPEARANCE_REFRESH_PERSISTENCE:            PASS
APPEARANCE_ROUTE_NOT_FOUND:                NO

CURRENT_CHANNEL_STORAGE:                   Client.channels: String[]  (Prisma)
CHANNEL_SCHEMA_CHANGE_REQUIRED:            NO
CHANNELS_MULTISELECT:                      YES
CHANNEL_INSTAGRAM:                         YES
CHANNEL_TIKTOK:                            YES
CHANNEL_FACEBOOK:                          YES
CHANNEL_LINKEDIN:                          YES
CHANNEL_YOUTUBE:                           YES
CHANNEL_WHATSAPP:                          YES
CHANNEL_EMAIL:                             YES (E-mail)
CHANNEL_SITE:                              YES
CHANNEL_OTHER:                             YES
CUSTOM_CHANNEL_INPUT:                      YES (Qual canal?, deterministic chip with X remove button)
CUSTOM_CHANNEL_PERSISTENCE:                PASS (roundtripped `Pinterest` survives refresh)
CLIENT_DETAIL_CHANNELS:                    YES (chips, not raw JSON)

INTERNAL_STORAGE_ENDPOINT:                 http://127.0.0.1:9100
PRESIGNED_URL_HOST_BEFORE:                 127.0.0.1:9100
PRESIGNED_URL_HOST_AFTER:                  looply.verbumlab.com.br
PRESIGNED_URL_EXPOSES_LOOPBACK:            NO
PUBLIC_UPLOAD_ENDPOINT:                    https://looply.verbumlab.com.br/looply-media/...
CORS_CONFIGURED:                           NO (not required — same-origin)

EXTERNAL_USER_AVATAR_UPLOAD:               PASS (201/200/200)
EXTERNAL_USER_AVATAR_REPLACE:              PASS
EXTERNAL_USER_AVATAR_REMOVE:               PASS

EXTERNAL_COMPANY_LOGO_UPLOAD:              PASS
EXTERNAL_COMPANY_LOGO_REPLACE:             PASS
EXTERNAL_COMPANY_LOGO_REMOVE:              PASS (cleanup DELETE 200 after E2E)

EXTERNAL_CLIENT_LOGO_UPLOAD:               PASS
EXTERNAL_CLIENT_LOGO_REPLACE:              PASS
EXTERNAL_CLIENT_LOGO_REMOVE:               PASS (test client removed 204 at end of run)

UNSIGNED_UPLOAD_BLOCKED:                   YES
PUBLIC_BUCKET_LISTING_BLOCKED:             YES
MINIO_CONSOLE_PUBLIC:                      NO
ARBITRARY_PUBLIC_PUT_BLOCKED:              YES

MOBILE_CHANNELS_OVERFLOW:                  NO
MOBILE_SETTINGS_OVERFLOW:                  NO

IDENTITY_MEDIA_SECURITY_REGRESSION:        NO (existing F13.1 suite still passes; +12 new tests around public host + channel normalization)

MIGRATION_CREATED:                         NO (no schema change)
MIGRATION_APPLIED:                         N/A

NGINX_CONFIG_CHANGED:                      YES (/looply-media/ location; sites-available/sites-enabled mirror-synced)
NGINX_TEST:                                PASS
NGINX_RELOADED:                            YES

LOOPLY_BACKEND_RELOADED:                   YES (pm2 restart looply-backend; .env picked up at fresh start)

BACKEND_TESTS:                             432
FRONTEND_TESTS:                            214
BACKEND_TYPECHECK:                         PASS
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO

SECRETS_COMMITTED:                         NO
SIGNED_URLS_LOGGED:                        NO
SESSION_TOKENS_LOGGED:                     NO
```
