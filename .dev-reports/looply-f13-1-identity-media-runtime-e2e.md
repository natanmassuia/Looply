# F13.1 — Identity Media Runtime Activation

Date: 2026-08-17 · Branch: main @ 8487e4a14a9adf925021ebc6eb9b8bf007004c98
Method: existing F13 code activated in the real runtime (PM2 backend + Nginx TLS frontend at
https://looply.verbumlab.com.br). E2E driven through the public HTTPS endpoint using the exact
API sequence the served `ImageUpload.tsx` bundle performs (upload-intent → presigned PUT →
complete → canonical `/api/media/file` reference). No source changes made.

## Baseline
- Branch `main`, HEAD `8487e4a`, 43 working-tree entries (29 modified + new F13 files), 1420+/816−.
- All F12.2/F13 files intact (media.ts, identityMediaService.ts, ImageUpload.tsx, modals, 2 migrations).
- No commit / no push / no reset / no stash. Unchanged at close.

## Resource Safety
- `free -h` gate checked before and after every heavy command; available never < 1.3 Gi.
- All six validations strictly sequential; nothing backgrounded; single OpenCode session.
- AVAILABLE_RAM_START: ~1.9 Gi · AVAILABLE_RAM_FINAL: ~1.8 Gi · RESOURCE_PRESSURE: none

## Runtime Inventory
- looply-backend: PM2 id 0, fork, `node /opt/looply/backend/dist/server.js`, cwd /opt/looply, port 4000.
- looply-minio: docker `minio/minio:RELEASE.2025-04-22` Up 11h, 127.0.0.1:9100→9000 (health 200).
- looply-redis: docker `redis:7-alpine` Up 2d.
- KORE_RUNNING_BEFORE: partial (kore-frontend PM2 online; kore-prod "waiting") · KORE_TOUCHED: NO

## Migration Audit
- MIGRATION_NAME: `20260824200000_client_logo` (+ prerequisite `20260824100000_user_phone_company_logo`)
- MIGRATION_PATH: `backend/prisma/migrations/<name>/migration.sql`
- SQL inspected: `ALTER TABLE "Client"/"Company"/"User" ADD COLUMN logoUrl/phone TEXT` — additive only, no DROP/TRUNCATE/rewrite.
- `prisma migrate status` (via repo's `dotenv -e ../.env` mechanism): **up to date, 14 found, 0 pending**.
- Columns verified live in Postgres: Client.logoUrl, Company.logoUrl, User.phone.
- MIGRATION_APPLIED: already applied before session (no-op); deploy unnecessary; no reset/db push ever run.

## Storage Configuration
- STORAGE_PROVIDER: S3-compatible (MinIO via @aws-sdk/client-s3 + s3-request-presigner)
- STORAGE_ENDPOINT: http://127.0.0.1:9100 (localhost only) · BUCKET: looply-media (HeadBucket OK)
- PRESIGNED_UPLOAD_SUPPORTED: YES (per-object PutObject presign, TTL 600s, content-length bound)
- DELETE_SUPPORTED: YES (DeleteObject on replace/remove)

## Backend Dist
- dist built 00:09 > newest source (22:54); all endpoints present in dist (identityMediaService.js,
  media.js: avatar/company/client intent+complete+delete, /api/media/file). Running PM2 process had
  started 23:44 (pre-build) → reload required.

## Backend Reload
- OLD_PID 303037 (uptime 10h) → `pm2 restart looply-backend` → NEW_PID 462128, online, 0 unstable.
- LOOPLY_BACKEND_RELOADED: YES

## Frontend Artifact
- Nginx root `/opt/looply/frontend/dist` (site looply.verbumlab.com.br, Let's Encrypt TLS).
- Source: ImageUpload wired in MyAccountModal (Minha conta), EditCompanyModal/Settings (Empresa),
  ClientDetail (Editar cliente). Bundle `index-D56-VnK-.js` contains upload-intent flow.
- Rebuild in Phase 15 reproduced identical hashed filenames → served artifact current.
- SOURCE_CURRENT / DIST_CURRENT / SERVED_ARTIFACT_CURRENT: all YES · FRONTEND_ARTIFACT_CURRENT: YES

## User Avatar E2E
- intent 201 → presigned PUT 200 → complete 200 → `user.avatarUrl=/api/media/file?key=users/<uid>/avatar/<uuid>.png`
- GET /api/auth/me persists reference (DB-backed, survives browser refresh).
- `/api/media/file` serves real PNG (200, 69 bytes, valid image data) through full TLS→nginx→backend→MinIO path.
- Negative proof of complete-side guard: PUT with wrong content-length → MinIO SignatureDoesNotMatch → complete correctly 409 ("objeto ainda não enviado").
- Replace: second upload switches avatarUrl to new key; old object deleted (HEAD NotFound).
- Remove: DELETE 200 → avatarUrl null → UI falls back to initials (MyAccountModal conditional + initials circle).
- Sidebar lower-left account trigger is initials-only by design (Figma 04 App Shell); avatar image renders in Minha conta and Settings account section.
- USER_AVATAR_UPLOAD: PASS · REPLACE: PASS · REMOVE: PASS · PERSISTENCE: PASS · ACCOUNT_MENU_SYNC: initials-only by design

## Company Logo E2E
- Upload/replace/remove all 200/201 through /api/settings/company/logo/*.
- Logo served 200 via /api/media/file; sidebar workspace identity consumes companyLogoUrl (Sidebar.tsx:97-110) with workspace-initials fallback.
- Regression: name "Looply Studio", timezone America/Sao_Paulo unchanged; phone untouched (never written).
- COMPANY_LOGO_UPLOAD/REPLACE/REMOVE/PERSISTENCE: PASS · SIDEBAR_COMPANY_LOGO: PASS (source + live serve)

## Client Logo E2E
- Client: "Restaurante do Gordão" (cmsrzcsre000pe0af1d6xzwhc), logoUrl null before and after (restored).
- Upload: key `company/<co>/clients/<cid>/logo/<uuid>.png`; clients list and /api/clients/:id both return reference (card + detail paths).
- Replace + remove verified; final state logoUrl null, status ACTIVE.
- Regression: GET /api/clients/:id (Abrir) 200, GET /api/contents 200 + /api/contents/:id 200 (Demandas ativas modal + demand detail data path).
- CLIENT_LOGO_UPLOAD/REPLACE/REMOVE/PERSISTENCE/CARD_LOGO/DETAIL_LOGO: PASS

## MIME Security
- application/pdf, image/svg+xml, image/gif → 400 "Tipo de arquivo não permitido" (avatar + client domains).
- Storage-side double check: complete re-validates head.contentType.

## Size Security
- sizeBytes 5,242,881 (5 MB + 1) → 400 at intent (avatar + company); sizeBytes 0 → 400 validation.
- Presigned PUT binds declared content-length; complete re-checks head.sizeBytes ≤ 5 MB.

## Tenant Isolation
- Single-tenant Demo V1. Client lookups are `findFirst({id, companyId})`: unknown client id → 404.
- Media read for foreign tenant prefix `company/OTHERCO/...` → 403.

## Object Key Security
- Keys generated server-side (`randomUUID()` + domain prefix). Intent schema accepts only
  contentType/sizeBytes/originalName — no key/bucket/path input from browser.
- complete enforces `startsWith(own prefix)` + `..` traversal ban: foreign-user key, wrong-prefix key,
  `../../etc/passwd`, cross-domain key → all 403.

## Delete Authorization
- Unauthenticated DELETE on avatar/company/client logo → 401. Authenticated cross-key complete → 403.

## Replacement Semantics
- New object uploaded under new server key → DB row updated to new canonical URL → old object
  DeleteObject'd afterward (best-effort, warn-logged on failure).

## Old Object Cleanup
- Direct MinIO HEAD after each replace/remove: every superseded object NotFound.
- Final bucket scan: **0 objects** — no orphans from the entire E2E run.

## Regression
- PROFILE (auth/me 200), COMPANY (settings/company 200, fields stable), CLIENT (Abrir/detail/demands 200),
  SETTINGS appearance 200, AUTH: login 200, password-recovery 200 (non-enumerable generic response),
  password-reset invalid token 400. Meta/WhatsApp untouched.

## Sequential Validation
1. backend typecheck — PASS (exit 0)
2. backend tests — 35 files / **420 passed**
3. backend build — PASS
4. frontend typecheck — PASS
5. frontend tests — 16 files / **204 passed**
6. frontend build — PASS (identical asset hashes → served artifact unchanged)

## Process Leak Audit
- ORPHAN_VITEST: none · ORPHAN_TSC: none (serena LSP only) · DUPLICATE_OPENCODE: none (single PID 455493)

## Secret Audit
- git diff scan: no AWS/MINIO/S3/API_KEY/SECRET material. `.env` gitignored, no env files in status.
- Looply logs (500 lines): 0 presigned-URL patterns, 0 session tokens. Credentials only read via
  process.env server-side; browser receives only per-object short-TTL presigned URL + canonical /api/media/file path.
- SECRETS_COMMITTED: NO · SIGNED_URLS_LOGGED: NO · SESSION_TOKENS_LOGGED: NO

## Git Status
- Working tree identical to session start (43 entries). No commit, no push.

## Final Status
F13.1 IDENTITY MEDIA — LIVE VERIFIED
