# F14.1.1 — Unified Client Edit + Identity Media Propagation

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: reproduce the two client-edit flows and the media-propagation gaps against the live
runtime, unify the editor into one canonical component, and make identity media flow from
canonical server state to every relevant UI surface via proper query invalidation +
projection fixes. Backend projections minimally extended. No migration. No commit. No push.

## Baseline
- F14 / F14.1 LIVE VERIFIED (backend 432 tests, frontend 224 tests).
- Working tree dirty: 58 entries at start (F12.2 → F14.1 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Reproduction Matrix

| ENTITY_OR_FLOW        | WRITE_ENDPOINT                    | WRITE_OK | READ_QUERY        | READ_FIELD              | UI_SURFACE             | CURRENT_RESULT                    | ROOT_CAUSE                                                        | ACTION |
|-----------------------|-----------------------------------|----------|-------------------|-------------------------|------------------------|-----------------------------------|-------------------------------------------------------------------|--------|
| User avatar           | `/api/me/avatar/...`              | 201/200/200 | `["me"]`       | user.avatarUrl          | Minha conta / Settings | shows photo                        | ✓ fine                                                           | — |
| User avatar → Team    | same                              | ✓        | `["team"]`/`["members"]` | team[].avatarUrl / member.user.avatarUrl | Team cards     | initials only                     | `useUploadUserAvatar` invalidated only `["me"]`; `listMembers` user select omitted avatarUrl | api.ts invalidation + memberService projection |
| User avatar → Sidebar | same                              | ✓        | `["me"]`          | user.avatarUrl          | Sidebar account trigger | initials only                     | Sidebar account trigger hardcoded to initials                     | Sidebar renders avatarUrl |
| Company logo          | `/api/settings/company/logo/...`  | ✓        | `["me"]`          | workspace.logoUrl       | Sidebar brand / Settings | Settings OK; Sidebar initials only | `resolveWorkspaceContext` did not return logoUrl → /me workspace lacked it | capabilities.ts + dashboardService select |
| Client logo           | `/api/clients/:id/logo/...`       | ✓        | `["clients"]`/`["client",id]` | clients[].logoUrl / client.logoUrl | Clients card / Detail | initials only                    | card/detail rendered brand-color initials, ignored logoUrl        | Clients.tsx + ClientDetail.tsx render logoUrl |
| Client edit           | `PATCH /api/clients/:id`          | ✓        | —                 | —                       | Clients "Editar"        | full editor, NO ImageUpload       | two divergent editors (duplication)                               | unified ClientEditor |

## Identity Authority Map

```
USER
  USER_IMAGE_DB_FIELD:          User.avatarUrl
  USER_UPLOAD_WRITE_ENDPOINT:   POST /api/me/avatar/upload-intent → PUT → POST /api/me/avatar/complete
  AUTH_ME_IMAGE_FIELD:          user.avatarUrl (already present)
  TEAM_MEMBER_IMAGE_FIELD:      team[].avatarUrl (already present) · member.user.avatarUrl (added)
  SIDEBAR_USER_SOURCE:          useMe → data.user.avatarUrl (rendered now)
  PROFILE_USER_SOURCE:          useMe → user.avatarUrl (MyAccountModal, already present)

COMPANY
  COMPANY_IMAGE_DB_FIELD:       Company.logoUrl
  COMPANY_UPLOAD_WRITE_ENDPOINT: POST /api/settings/company/logo/upload-intent → … → complete
  COMPANY_SETTINGS_IMAGE_FIELD: /api/settings/company → company.logoUrl (already present)
  AUTH_ME_COMPANY_IMAGE_FIELD:  workspace.logoUrl (ADDED to resolveWorkspaceContext)
  SIDEBAR_COMPANY_SOURCE:       useMe → workspace.logoUrl (now populated)

CLIENT
  CLIENT_IMAGE_DB_FIELD:        Client.logoUrl
  CLIENT_UPLOAD_WRITE_ENDPOINT: POST /api/clients/:id/logo/upload-intent → … → complete
  CLIENT_LIST_IMAGE_FIELD:      listClients → logoUrl (already present)
  CLIENT_DETAIL_IMAGE_FIELD:    getClient → logoUrl (already present)
  CLIENT_DEMAND_PROJECTION_IMAGE_FIELD: not present — demand surfaces show text/color, not avatars → no backend change (Phase 20 rule)
  DEMAND_CLIENT_IMAGE_FIELD:    not used
```

No duplicate media state was created. Server state remains the authority; all surfaces read the
same query keys.

## Query / Cache Map

```
SURFACE           HOOK                       QUERY_KEY               SERVER_ENDPOINT              IMAGE_FIELD               INVALIDATED_AFTER_UPLOAD          STALE_REASON
Sidebar           useMe                       ["me"]                 /api/auth/me                workspace.logoUrl          user avatar: yes / logo: yes       workspace lacked logoUrl (backend)
Sidebar account   useMe                       ["me"]                 /api/auth/me                user.avatarUrl             yes (was only ["me"])              trigger rendered initials
Team              useTeam / useMembers        ["team"] / ["members"] /api/team / /api/members   avatarUrl                  was NOT for avatar                upload only invalidated ["me"]
Minha conta       useMe                       ["me"]                 /api/auth/me                user.avatarUrl             yes                                 —
Settings Empresa  useCompanySettings          ["companySettings"]    /api/settings/company       company.logoUrl            yes (logo mutation)                —
Settings account  useMe                       ["me"]                 /api/auth/me                user.avatarUrl             yes                                 —
Clients list      useClients                  ["clients"]            /api/clients                client.logoUrl             yes (client logo mutation)         card rendered initials
Client Detail     useClient                   ["client", id]         /api/clients/:id            client.logoUrl             yes (client logo mutation)         header rendered initials
```

## Client Edit Duplication Root Cause

```
CLIENT_EDIT_ENTRY_POINTS:       2 — Clients list "Editar"; Client Detail "Editar cliente"
CLIENT_EDIT_COMPONENTS:         Clients.tsx inline ModalOrSheet form; ClientDetail.tsx inline ModalOrSheet form
CLIENT_EDITOR_WITH_IMAGE:       ClientDetail.tsx (had ImageUpload, lacked ChannelPicker)
CLIENT_EDITOR_WITHOUT_IMAGE:    Clients.tsx (had ChannelPicker + all fields, lacked ImageUpload)
CLIENT_EDIT_DUPLICATION_ROOT_CAUSE: two independently maintained inline forms drifted apart —
  neither was complete, and both mutated the same PATCH /api/clients/:id contract.
```

## Canonical Client Edit

New `frontend/src/components/ClientEditor.tsx` — single reusable editor used by BOTH entry
points. Contains: ImageUpload (edit mode), name, brand color, status, contact person,
e-mail, phone, ChannelPicker. Create mode (client=null) + edit mode (client set) both handled.
Form state initializes synchronously in a keyed inner component (`key={client?.id ?? "new"}`)
so ChannelPicker's "Outro" state mounts with the correct custom-channel set — no effect-order
races.

```
CANONICAL_CLIENT_EDIT_COMPONENT:   ClientEditor (components/ClientEditor.tsx)
CLIENT_LIST_USES_CANONICAL_EDITOR: YES (Clients.tsx → <ClientEditor>)
CLIENT_DETAIL_USES_CANONICAL_EDITOR: YES (ClientDetail.tsx → <ClientEditor>)
LEGACY_CLIENT_EDIT_REMOVED:        YES (both inline forms deleted)
CLIENT_IMAGE_UPLOAD_IN_CANONICAL_EDITOR: YES
```

Client Editor state consistency: both entry points pass the same `client` object → same fields,
same mutation path, same invalidation (`["clients"]`, `["client", id]`, `["dashboard"]`).

## User Avatar Root Cause

```
USER_AVATAR_PROPAGATION_ROOT_CAUSE:
  1. useUploadUserAvatar/useDeleteUserAvatar invalidated ONLY ["me"] — Team ("team"/"members")
     queries never refetched after upload/remove.
  2. /api/members projected user without avatarUrl (memberService.listMembers user select) —
     even a refetch couldn't render the photo on the Team page.
  3. Sidebar account trigger (and mobile account button) rendered initials unconditionally.
```

## User Avatar Projection

```
TEAM_API_AVATAR_FIELD_BEFORE: /api/team YES (teamService already selected avatarUrl); /api/members NO
TEAM_API_AVATAR_FIELD_AFTER:  both YES (memberService.listMembers user select += avatarUrl)
```

## User Avatar Propagation

```
USER_INVALIDATION_KEYS: ["me"] + ["team"] + ["members"] + ["dashboard"]
USER_AVATAR_MY_ACCOUNT: PASS (already rendered photo)
USER_AVATAR_SIDEBAR:    PASS (Sidebar account trigger renders photo, initials fallback)
USER_AVATAR_TEAM:       PASS (both members + team render paths show photo, initials fallback)
USER_AVATAR_LIVE_PROPAGATION: PASS — verified live: upload → /me, /team, /members all reflect same key
USER_AVATAR_REFRESH_PERSISTENCE: PASS (server-backed via /api/media/file)
USER_AVATAR_REMOVE_PROPAGATION:  PASS — DELETE → user.avatarUrl null in /me AND /team; initials everywhere
```

## Company Logo Root Cause

```
COMPANY_LOGO_PROPAGATION_ROOT_CAUSE: resolveWorkspaceContext (backend/src/domain/capabilities.ts)
  returned WorkspaceContext WITHOUT logoUrl, so /api/auth/me → workspace.logoUrl was undefined
  even though Company.logoUrl was persisted. Sidebar reads workspace.logoUrl → always null.
  (dashboardService's company select also omitted logoUrl.)
```

## Company Logo Propagation

```
COMPANY_INVALIDATION_KEYS: ["me"] + ["companySettings"] (unchanged — now sufficient)
COMPANY_LOGO_SETTINGS:            PASS (settings/company → company.logoUrl)
COMPANY_LOGO_SIDEBAR:             PASS (workspace.logoUrl now populated → Sidebar brand renders photo)
COMPANY_LOGO_WORKSPACE_IDENTITY:  PASS (workspace context from /me carries logoUrl)
COMPANY_LOGO_LIVE_PROPAGATION:    PASS — verified live (upload → workspace.logoUrl + settings both update)
COMPANY_LOGO_REFRESH_PERSISTENCE: PASS
COMPANY_LOGO_REMOVE_PROPAGATION:  PASS — DELETE → workspace.logoUrl null; Sidebar falls back to Looply mark
```

## Client Logo Root Cause

```
CLIENT_LOGO_PROPAGATION_ROOT_CAUSE: backend already projected logoUrl in list + detail; the
  frontend cards/header simply rendered brand-color initials and ignored the field. The client
  logo mutation already invalidated ["clients"] + ["client", id], so propagation needed only
  render-side consumption.
```

## Client Logo Propagation

```
CLIENT_INVALIDATION_KEYS: ["clients"] + ["client", id] (unchanged)
CLIENT_LOGO_CLIENTS_LIST:  PASS — card renders logoUrl, initials fallback; verified live
CLIENT_LOGO_CLIENT_DETAIL: PASS — header renders logoUrl; editor + detail update after upload
CLIENT_LOGO_DEMAND_SURFACES: none changed — ClientDemandsModal / grouped header show color dot +
  text name (no avatar surface); Phase 20 rule says don't add images to text-only surfaces
CLIENT_PROJECTION_BACKEND_CHANGE_REQUIRED: NO
CLIENT_LOGO_REFRESH_PERSISTENCE: PASS
CLIENT_LOGO_REMOVE_PROPAGATION:   PASS — DELETE → list/detail logoUrl null; initials everywhere
```

## Cache Invalidation Contract

Targeted invalidation only (no global `clear()`):
- User avatar/remove → `["me"]`, `["team"]`, `["members"]`, `["dashboard"]`.
- Company logo → `["me"]`, `["companySettings"]` (existing; /me now carries the field).
- Client logo → `["clients"]`, `["client", id]` (existing; render now consumes it).

## Identity Components

No new generic Avatar component was created (task: "Do not redesign Avatar component broadly if
unnecessary"). Each surface uses the same pattern: `avatarUrl/logoUrl ? <img className="… rounded-full object-cover"> : initials`. `object-cover` on user avatars, `object-cover` + border on client/company logos. `alt` empty on decorative avatars inside labeled controls, `alt={name}` on standalone identity images.

## Failure Semantics

Unchanged from F13/F14 — upload failures keep the old image (no premature cache nulling), replace
only persists after complete succeeds, remove only clears after server success. No optimistic media state.

## Desktop QA (1440px)

- Clients → Editar: canonical editor with image upload + channels + all fields.
- Client Detail → Editar: identical canonical editor (same component).
- User avatar upload → Minha conta, Sidebar account, Team all update.
- Company logo upload → Settings + Sidebar update.
- Client logo upload → client card + detail update.

## Mobile QA (390px)

- Single Edit Client sheet (ModalOrSheet), same fields as desktop, image upload + ChannelPicker accessible, no overflow, closing sheet keeps updated image.
- User avatar → mobile account button shows photo.
- Company logo → workspace identity where rendered.
- No horizontal overflow.

## Navigation Persistence

```
IDENTITY_MEDIA_NAVIGATION_PERSISTENCE: PASS — avatar/logo flows verified across Dashboard →
  Team → Settings navigation; Sidebar reads the same ["me"] query everywhere.
```

## Refresh Persistence

```
IDENTITY_MEDIA_REFRESH_PERSISTENCE: PASS — after full browser refresh, /api/auth/me and
  /api/clients rehydrate server state (no reliance on client cache). Verified for avatar,
  company logo, client logo (and after removals).
```

## Tenant / Authorization Safety

- `/api/team` and `/api/members` remain session-scoped; avatarUrl added to the existing member
  projection only — no new endpoint, no role change, no sensitive field expansion.
- Client logo read stays `findFirst({ id, companyId })` tenant-scoped.
- Company logo belongs to the session company (`req.auth.companyId`).
- No arbitrary IDs introduced; `logoUrl`/`avatarUrl` are additive read fields.

## Regression

```
F14_REGRESSION:  PASS — appearance PATCH customColors:null 200, company name/timezone 200,
  channels normalization intact, public upload URL host = looply.verbumlab.com.br (no loopback).
F14_1_REGRESSION: PASS — grouped-demand status wrapping + mobile Settings header entry untouched
  (no source changes to those files this session).
```

## Runtime Activation

- Backend changed (3 projection files) → `npm run build` + `pm2 restart looply-backend` (only).
- Frontend changed → `npm run build` → served bundle `index-hgA8bvMz.js`; Nginx serves
  `/opt/looply/frontend/dist` (unchanged root, no Nginx reload).
- No migration. No Kore.

```
LOOPLY_BACKEND_RELOADED: YES
FRONTEND_ARTIFACT_CURRENT: YES
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Backend tests  | 432    | 434   |
| Frontend tests | 224    | 231   |

Backend additions (legacyTeamDeprecation.test.ts, live-DB gated):
- GET /api/team projects avatarUrl.
- GET /api/auth/me workspace exposes logoUrl.

Frontend additions:
- clients.test.tsx: client card renders logoUrl; list opens canonical editor (image upload +
  Canais label + Instagram chip pressed).
- components.test.tsx (source contract): Clients + ClientDetail both use ClientEditor; neither
  retains the legacy inline partial editor (no ChannelPicker in Clients.tsx, no ImageUpload in
  ClientDetail.tsx); canonical editor contains ImageUpload + ChannelPicker + field placeholders;
  Sidebar renders avatarUrl with initials fallback; Team renders u.avatarUrl.
- team.test.tsx (rendered): member with avatarUrl → `<img>`, member without → initials.

## Resource Safety

```
AVAILABLE_RAM_START: ~1.7 Gi
AVAILABLE_RAM_FINAL: ~1.6 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → backend build → backend typecheck →
backend tests → frontend build.

## Git Status

Working tree preserved (F12.2 → F14.1.1). Session touched:
backend: `domain/capabilities.ts`, `services/dashboardService.ts`, `services/memberService.ts`,
`tests/legacyTeamDeprecation.test.ts`
frontend: `components/ClientEditor.tsx` (new), `features/Clients.tsx`, `features/ClientDetail.tsx`,
`components/Sidebar.tsx`, `components/AppLayout.tsx`, `features/Team.tsx`, `lib/api.ts`,
`lib/types.ts`, `tests/clients.test.tsx`, `tests/team.test.tsx`, `tests/components.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.7 Gi
AVAILABLE_RAM_FINAL:                       ~1.6 Gi

CLIENT_EDIT_ENTRY_POINTS:                  2 (list "Editar", detail "Editar cliente")
CLIENT_EDIT_COMPONENTS:                    1 canonical (ClientEditor) — legacy inline forms removed
CLIENT_EDITOR_WITH_IMAGE:                  ClientEditor (both entry points)
CLIENT_EDITOR_WITHOUT_IMAGE:               none
CLIENT_EDIT_DUPLICATION_ROOT_CAUSE:        two divergent inline forms sharing one API contract

CANONICAL_CLIENT_EDIT_COMPONENT:           ClientEditor (components/ClientEditor.tsx)
CLIENT_LIST_USES_CANONICAL_EDITOR:         YES
CLIENT_DETAIL_USES_CANONICAL_EDITOR:       YES
LEGACY_CLIENT_EDIT_REMOVED:                YES
CLIENT_IMAGE_UPLOAD_IN_CANONICAL_EDITOR:   YES

USER_IMAGE_DB_FIELD:                       User.avatarUrl
AUTH_ME_IMAGE_FIELD:                       user.avatarUrl
TEAM_MEMBER_IMAGE_FIELD:                   team[].avatarUrl · member.user.avatarUrl
USER_AVATAR_PROPAGATION_ROOT_CAUSE:        avatar mutation invalidated only ["me"]; /api/members omitted avatarUrl; Sidebar trigger initials-only
TEAM_API_AVATAR_FIELD_BEFORE:              /api/team YES · /api/members NO
TEAM_API_AVATAR_FIELD_AFTER:               both YES
USER_INVALIDATION_KEYS:                    ["me"], ["team"], ["members"], ["dashboard"]
USER_AVATAR_MY_ACCOUNT:                    PASS
USER_AVATAR_SIDEBAR:                       PASS
USER_AVATAR_TEAM:                          PASS
USER_AVATAR_LIVE_PROPAGATION:              PASS
USER_AVATAR_REFRESH_PERSISTENCE:           PASS
USER_AVATAR_REMOVE_PROPAGATION:            PASS

COMPANY_IMAGE_DB_FIELD:                    Company.logoUrl
AUTH_ME_COMPANY_IMAGE_FIELD:               workspace.logoUrl (added)
COMPANY_LOGO_PROPAGATION_ROOT_CAUSE:       resolveWorkspaceContext omitted logoUrl
COMPANY_INVALIDATION_KEYS:                 ["me"], ["companySettings"]
COMPANY_LOGO_SETTINGS:                     PASS
COMPANY_LOGO_SIDEBAR:                      PASS
COMPANY_LOGO_WORKSPACE_IDENTITY:           PASS
COMPANY_LOGO_LIVE_PROPAGATION:             PASS
COMPANY_LOGO_REFRESH_PERSISTENCE:          PASS
COMPANY_LOGO_REMOVE_PROPAGATION:           PASS

CLIENT_IMAGE_DB_FIELD:                     Client.logoUrl
CLIENT_LIST_IMAGE_FIELD:                   clients[].logoUrl
CLIENT_DETAIL_IMAGE_FIELD:                 client.logoUrl
CLIENT_LOGO_PROPAGATION_ROOT_CAUSE:        frontend rendered brand-color initials, ignored existing logoUrl field
CLIENT_INVALIDATION_KEYS:                  ["clients"], ["client", id]
CLIENT_LOGO_CLIENTS_LIST:                  PASS
CLIENT_LOGO_CLIENT_DETAIL:                 PASS
CLIENT_LOGO_DEMAND_SURFACES:               none (text/color surfaces only; no avatar surface)
CLIENT_PROJECTION_BACKEND_CHANGE_REQUIRED: NO
CLIENT_LOGO_REFRESH_PERSISTENCE:           PASS
CLIENT_LOGO_REMOVE_PROPAGATION:            PASS

IDENTITY_MEDIA_NAVIGATION_PERSISTENCE:     PASS
IDENTITY_MEDIA_REFRESH_PERSISTENCE:        PASS

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     3 (capabilities.ts, dashboardService.ts, memberService.ts)
LOOPLY_BACKEND_RELOADED:                   YES
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS

BACKEND_TESTS:                             434
FRONTEND_TESTS:                            231
BACKEND_TYPECHECK:                         PASS
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO
```

F14.1.1 CLIENT EDIT + IDENTITY PROPAGATION — LIVE VERIFIED