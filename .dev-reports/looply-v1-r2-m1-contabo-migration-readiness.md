# Looply — V1-R2.M1 Contabo Migration Readiness Audit

Date: 2026-08-18 · Branch: `main` @ `2d4909e` · Discovery/planning only — no infra changed, no
Contabo provisioned, no DNS changed, no deploy, no commit, no push. `KORE_TOUCHED: NO`.

## 1. Host

| Item | Value |
|------|-------|
| OS | Ubuntu 24.04.4 LTS (kernel 6.8.0-136-generic) |
| Hostname | `srv1843655` (Hostinger VPS) |
| CPU | 1 vCPU (`nproc`=1) |
| RAM | 3.8Gi total, ~2.3Gi used, ~1.5Gi available |
| Disk | `/` 48G (26G used, 23G avail, 53%) — single `/dev/sda1` |
| Timezone | `America/Sao_Paulo` (-03) |
| Resource pressure | Moderate: 1 vCPU + 3.8Gi RAM is tight with Kore + Looply + MinIO + Redis + Postgres all resident. Monitor before cutover. |

## 2. Runtime

| Item | Value |
|------|-------|
| Node | `v24.18.0` (nvm, `/home/koreadmin/.nvm`) |
| npm | `11.16.0` |
| PM2 | `7.0.3`, systemd startup `pm2-koreadmin` **enabled** |
| Looply process | `looply-backend`, fork, 1 instance, `cwd=/opt/looply`, `script=backend/dist/server.js`, `PORT=4000`, `NODE_ENV=production`, `autorestart=true`, `max_memory_restart=500M`, restarts=10 |
| Env loading | PM2 process inherits env; `.env` sourced by the app at boot (repo `.env` present, git-ignored); `ecosystem.config.cjs` sets `NODE_ENV`+`PORT` only |
| Working dirs | `/opt/looply` (app), `/opt/looply/frontend/dist` (static), `/opt/looply/.backups` (backups, gitignored) |
| Ports | 4000 (Looply API), see §11 |

`DEPLOYMENT_AUTHORITY` details in §12.

## 3. PostgreSQL

| Item | Value |
|------|-------|
| Server | **PostgreSQL 16.14** (Ubuntu package), systemd `postgresql.service` **enabled** |
| Client | psql/pg_config 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1) |
| Local/container | **Local service** (`/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main`), NOT docker |
| DB name | `looply` |
| Role (names only) | `looply` (app), `postgres` (superuser) |
| Bind/listen | `127.0.0.1:5432` + `[::1]:5432` (localhost only; `listen_addresses` default local) |
| Data path | `/var/lib/postgresql/16/main` (root-owned 700) |
| Migrations | 15 committed under `backend/prisma/migrations/`; `_prisma_migrations` table present |
| Backup/restore | R2.1 proven: `ops/backup/backup.sh` (pg_dump -Fc) + `restore.sh` (isolated) + `verify.sh`. Isolated DB restore drill PROVEN (R2.1A). |

## 4. Redis

| Item | Value |
|------|-------|
| Version | Redis `7.4.9` (image `redis:7-alpine`) |
| Local/container | **Docker container** `looply-redis` |
| Port/bind | `127.0.0.1:6379->6379/tcp` (localhost only) |
| Persistence | `aof_enabled:1`, rdb_bgsave 0, dbsize 0 (empty transient store) |
| Classification | **EPHEMERAL/DERIVABLE** — `backend/src/lib/transientStore.ts` uses `EX` TTL single-use keys only; `REDIS_BACKUP_REQUIRED: NO`. No migration needed. |

## 5. MinIO / S3

| Item | Value |
|------|-------|
| Image | `minio/minio:RELEASE.2025-04-22T22-12-26Z` |
| Local/container | **Docker container** `looply-minio` |
| Endpoint | `http://127.0.0.1:9100` (API), console `127.0.0.1:9101` (never proxied) |
| Bucket | `looply-media` |
| Object count | **4** (company logos/avatars) — verified read-only |
| Persistent volume | `/var/lib/docker/volumes/looply-minio-data/_data -> /data` (docker volume; root-owned, not directly readable by current user) |
| Public endpoint | `STORAGE_PUBLIC_ENDPOINT` (public S3 API URL via nginx `/looply-media/` proxy) |
| Credentials source | `STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY` from repo `.env` (names only; values never printed) |
| Backup/restore | R2.1 proven via `mc mirror` + checksum verify (4 objects byte-identical). |

## 6. Reverse proxy / web serving

| Item | Value |
|------|-------|
| Nginx | `1.24.0` (Ubuntu), systemd `nginx.service` **enabled**, master runs as `root` |
| Looply config | `/etc/nginx/sites-enabled/looply.verbumlab.com.br` (active) + a `.backup.f14-...` copy |
| Domain | `looply.verbumlab.com.br` |
| TLS | Let's Encrypt via **certbot 5.7.0**; cert `/etc/letsencrypt/live/looply.verbumlab.com.br/{fullchain,privkey}.pem` (root-only readable — expiry not readable by this user; certbot auto-renewal assumed via standard timer) |
| Upstream | `http://127.0.0.1:4000` for `/api/` and `/health`; `http://127.0.0.1:9100` for `/looply-media/` (S3 SigV4 path-style proxy, no trailing slash, `Host=$host` preserved) |
| Static | `root /opt/looply/frontend/dist`, SPA fallback `try_files $uri $uri/ /index.html` |
| Request size | `client_max_body_size 8m` on `/looply-media/` (covers 5MB identity-media limit) |
| HTTP→HTTPS | 301 redirect on port 80 |

## 7. Application

| Item | Value |
|------|-------|
| Backend build/start | `npm --prefix backend run build` (tsc) → `node dist/server.js` via PM2 |
| Frontend build | `npm --prefix frontend run build` (`tsc --noEmit && vite build`) → `frontend/dist` (served statically by nginx) |
| Prisma migrate | `npm --prefix backend run prisma:migrate:deploy` (`prisma migrate deploy`) |
| Health | `/health` (liveness, no DB) — returns 200 |
| Readiness | `/health/ready` (DB round-trip) — returns 200 (verified); returns 503 if DB down |
| Media | Uploads live in object storage (`looply-media`) with presigned URLs; `STORAGE_FORCE_PATH_STYLE` set; `backend/uploads` absent (dev-only, not in use) |
| Public media | `/looply-media/<bucket>/<key>` via nginx S3 proxy |
| Realtime/websocket | **None** detected (Express REST only) |

## 8. Secrets / config inventory

Env variable NAMES present in repo `.env` (values never printed):

```
CORS_ORIGIN, DATABASE_URL, DEV_DEMO_USER, FRONTEND_URL, NODE_ENV, PORT,
PUBLIC_APP_URL, REDIS_URL, RESEND_FROM, RESEND_REPLY_TO,
STORAGE_ACCESS_KEY, STORAGE_BUCKET, STORAGE_ENDPOINT,
STORAGE_FORCE_PATH_STYLE, STORAGE_PRESIGN_TTL_SECONDS, STORAGE_PUBLIC_ENDPOINT,
STORAGE_REGION, STORAGE_SECRET_KEY, VITE_API_URL
```

Code-referenced env names (from `backend/src/lib/env.ts`) add the external-provider set:
`ASSISTANT_LLM_API_KEY, ASSISTANT_LLM_BASE_URL, ASSISTANT_LLM_MODEL, GUPSHUP_API_KEY,
GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER, GUPSHUP_WEBHOOK_IP_ALLOWLIST, TRUST_PROXY,
WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN`.
Provider key/secret names present in repo `.env`: `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
(others are provider-side / set in provider portals).

**Classification:**
- **REQUIRED on Contabo (non-secret):** `NODE_ENV, PORT, CORS_ORIGIN, PUBLIC_APP_URL, FRONTEND_URL,
  VITE_API_URL, STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_REGION, STORAGE_FORCE_PATH_STYLE,
  STORAGE_PRESIGN_TTL_SECONDS, STORAGE_PUBLIC_ENDPOINT, REDIS_URL, TRUST_PROXY, DEV_DEMO_USER,
  GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER, GUPSHUP_WEBHOOK_IP_ALLOWLIST, ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_MODEL`.
- **REQUIRED on Contabo (secret, external provider):** `DATABASE_URL, STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY, RESEND_FROM, RESEND_REPLY_TO, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID, GUPSHUP_API_KEY, ASSISTANT_LLM_API_KEY`.
- **REGENERABLE:** SESSION/opaque cookie secret (random token, no JWT secret).
- **HOST-SPECIFIC:** `PUBLIC_APP_URL`, `FRONTEND_URL`, `VITE_API_URL`, `STORAGE_PUBLIC_ENDPOINT`
  must point at the new Contabo public host; `REDIS_URL`/`STORAGE_ENDPOINT`/`DATABASE_URL` point at
  the new host's loopback.

`SECRET_INVENTORY_STATUS: COMPLETE` (names only).

## 9. Persistent data (must survive migration)

| Path/state | Class | Migration action |
|------------|-------|------------------|
| PostgreSQL `looply` DB | PostgreSQL (DURABLE) | `backup.sh` → transfer → `restore.sh` → `verify.sh` |
| MinIO `looply-media` (4 objects) | Object storage (DURABLE) | `mc mirror` backup → restore |
| Repo `/opt/looply` (git) | repo | fresh `git clone` of `origin/main` @ `2d4909e` |
| Env/secrets | config | re-provision from external/manual store (values never in repo) |
| `backend/uploads` | DERIVABLE | **none** — absent, dev-only |
| Logs | DERIVABLE | PM2 logs; not migrated (regenerated) |
| `.backups/` | backup sets | transfer the final set; not part of app state |

## 10. External dependencies

- **Email**: `mailService.ts` (Resend) — `RESEND_FROM`, `RESEND_REPLY_TO` (+ key if used).
- **WhatsApp/Meta**: `whatsappProvider.ts`, `whatsappWebhook.ts` — `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`; webhook needs the
  public URL reachable (provider dashboards configure the callback URL).
- **Gupshup**: `gupshupProvider.ts`, `whatsappGupshupWebhook.ts` — `GUPSHUP_API_KEY`,
  `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER`, `GUPSHUP_WEBHOOK_IP_ALLOWLIST`.
- **Assistant LLM**: `assistantLanguageModel.ts` — `ASSISTANT_LLM_API_KEY`, `_BASE_URL`, `_MODEL`.
- **Storage**: MinIO/S3-compatible (loopback MinIO on the new host, or an S3 service).
- **OAuth/webhooks**: Meta/Gupshup dashboards must be re-pointed to the new public domain after
  cutover (webhook verify token matches env).
- **DNS/domain**: `looply.verbumlab.com.br` → new VPS IP after cutover.
- Not tested live in this audit (no provider calls made).

## 11. Network exposure

| Port | Owner | Class |
|------|-------|-------|
| 80, 443 | nginx (root) | **MUST BE PUBLIC** (HTTP/HTTPS for `looply.verbumlab.com.br`) |
| 22 | sshd | **MUST BE PUBLIC** (SSH admin) — restrict source IPs on Contabo |
| 4000 | looply-backend | localhost only — do NOT expose publicly on Contabo (only via nginx `/api/`) |
| 5432 | postgres | localhost only — never public |
| 6379 | redis (docker) | localhost only — never public |
| 9100/9101 | MinIO (docker) | localhost only — console 9101 never proxied |
| 3500 | kore-frontend (localhost) | localhost only (Kore, untouched) |
| 38433, 34421, 24282, 33939, 37259, 65529, 49374 | agent/MCP infra (relay, agy, serena, ai-memory) | localhost only — not needed on Contabo for Looply runtime |
| 127.0.0.54:53, 127.0.0.53:53 | systemd-resolved | local |

`PUBLIC_PORTS: 80, 443, 22` · `LOCAL_ONLY_PORTS: 4000, 5432, 6379, 9100, 9101 (+ agent infra)`.

## 12. Current deployment authority

- **Git**: `main` @ `2d4909e`, origin `git@github.com:natanmassuia/Looply.git` — **authoritative source of truth for code.**
- **PM2**: `ecosystem.config.cjs` (backend only) is the **process authority**; `pm2-koreadmin` systemd unit enabled for boot.
- **systemd**: `nginx.service`, `postgresql.service` enabled; `pm2-koreadmin` enabled.
- **Nginx**: `/etc/nginx/sites-enabled/looply.verbumlab.com.br` — **not in repo** (host-managed).
- **Env**: repo `.env` (git-ignored) — host-local, authoritative at runtime; `.env.backup.20260813-132904` is a stale host copy.
- **Migrations**: committed, applied via `prisma migrate deploy` (15 applied).
- **Conflict**: Nginx config + certbot + PM2 startup live **outside** the repo → the repo alone cannot rebuild the host. This is the key authority duplication to capture on Contabo. Also `looply.verbumlab.com.br` Nginx block is hand-maintained (the `.backup.f14-...` file shows manual edits).

`DEPLOYMENT_AUTHORITY: GIT (code) + PM2 (process) + NGINX/systemd (host, out-of-repo) + .env (config)`.
`AUTHORITY_DUPLICATION: YES` — nginx config, certbot, PM2 startup, and .env are host-managed, not versioned. Recommend documenting them on Contabo (R2.M2 checklist) but do not redesign now.

## 13. Migration compatibility

Current working stack must be reproduced on Contabo Ubuntu 24.04 (LTS, matches source):

| Component | Current | Contabo target (recommended, matching) |
|-----------|---------|-----------------------------------------|
| OS | Ubuntu 24.04.4 LTS | Ubuntu 24.04 LTS |
| Node | v24.18.0 (nvm) | Node 24 LTS (nvm, same major) |
| npm | 11.16.0 | ship with Node 24 |
| PM2 | 7.0.3 + systemd startup | PM2 7 + `pm2 startup systemd` |
| PostgreSQL | 16.14 (package) | PostgreSQL 16 (Ubuntu package) — same major, dump compatible |
| Redis | 7.4.9 (docker `redis:7-alpine`) | Redis 7 (docker `redis:7-alpine`) |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | Same image (pin exact release) |
| Nginx | 1.24.0 (Ubuntu) | Nginx 1.24 (Ubuntu) |
| certbot | 5.7.0 | certbot (Ubuntu) + Let's Encrypt |

`CONTABO_COMPATIBILITY: READY` — same distro/majors; no arbitrary version bumps; pg_dump custom
format is 16-compatible. Target >= 1 vCPU / >=4Gi RAM (current is 1vCPU/3.8Gi and tight).

## 14. Backup migration path

Current R2.1 tooling supports the full path:

```
current VPS
  → ops/backup/backup.sh        (pg_dump -Fc + mc mirror, checksummed set in .backups/<TS>/)
  → transfer backup set          (rsync/scp the .backups/<TS>/ dir to Contabo)
  → Contabo
  → ops/backup/restore.sh <set>  (isolated DB + bucket, or FORCE_DESTRUCTIVE for final)
  → ops/backup/verify.sh <set>   (checksums, _prisma_migrations, tables, counts, object integrity)
```

`BACKUP_MIGRATION_PATH: READY`.

**Missing migration-specific step (identify, not fix):** the transfer leg has **no explicit
off-host proof** — this audit does not execute it. For migration, the final backup set must be
transferred to Contabo and the restore+verify proven **on Contabo before cutover**. The R2.1 tooling
already supports cross-cluster restore (`RESTORE_TARGET_DB_URL`) and isolated buckets. No new tooling
required; only an executed drill on the new host.

## 15. Downtime / consistency plan

Architecture does **not** support zero-downtime cutover: single backend instance, host-local
Postgres + MinIO, no DB replication, no blue/green. Recommend the smallest safe strategy:

- **Maintenance window** (announced, low-traffic).
- **Backend write stop**: stop writes (PM2 stop `looply-backend` or set read-only) → stop accepting
  new writes before the final backup.
- **Final backup** after write stop (`backup.sh`) → the consistency point.
- **Transfer** final set to Contabo.
- **Restore + verify** on Contabo (isolated first, then authoritative).
- **DNS cutover**: reduce TTL ahead of time (recommend `TTL ~300s` on `looply.verbumlab.com.br` record
  at least 24-48h before), then flip the A/AAAA record to the Contabo IP.
- **Rollback window**: keep the old VPS running (frozen) for the observation period.

`DOWNTIME_STRATEGY: MAINTENANCE_WINDOW + WRITE_STOP + FINAL_BACKUP + DNS_TTL_REDUCTION + CUTOVER`.

## 16. Rollback

Concrete rollback path if Contabo validation fails:

1. Old VPS remains **authoritative and running** through the cutover window (writes stopped, not
   destroyed). It stays the source of truth for reads/rollback.
2. **DNS/proxy reverses** to old VPS (flip the record back — fast if TTL was pre-reduced).
3. Old VPS backend is resumed (start writes again).

**Data-consistency risk:** any writes made **after** the cutover to Contabo would be lost if you roll
back to the old VPS, unless those writes are captured. Because cutover happens after a write stop and
Contabo becomes authoritative at cutover, the safe order is: old VPS frozen → final backup → restore on
Contabo → verify → cutover → observe → only then release the old VPS. Do NOT resume old-VPS writes
after cutover. The rollback window is bounded by "no new writes on old VPS after write-stop" — so
rollback is safe only if no production writes occurred on Contabo yet. Risk is LOW for a frozen
cutover, but must be explicit.

`ROLLBACK_STRATEGY: OLD_VPS_FROZEN_AUTHORITATIVE_UNTIL_CUTOVER + DNS_REVERSAL + NO_OLD_WRITES_AFTER_CUTOVER`.

## 17. Contabo provisioning checklist (R2.M2)

Ordered:

1. Provision Contabo VPS (>=1 vCPU, >=4Gi RAM, >=48G disk — match or exceed current).
2. OS install + update: Ubuntu 24.04 LTS, `apt update && apt full-upgrade`.
3. User/SSH: create non-root user (e.g. `deploy`), SSH keys, disable password root login.
4. Firewall: ufw/cloud firewall — open only 22 (restricted), 80, 443; block everything else.
5. Node 24 LTS via nvm (match v24.18.0).
6. PostgreSQL 16 (package) — create `looply` role + DB; localhost bind only.
7. Redis 7 (docker `redis:7-alpine`) — localhost bind only.
8. MinIO (pin `RELEASE.2025-04-22T22-12-26Z`) — docker volume `looply-minio-data`, localhost 9100/9101.
9. Nginx 1.24 + copy the Looply server block (from §6, verbatim — including `/looply-media/` SigV4 proxy).
10. TLS: certbot + Let's Encrypt for `looply.verbumlab.com.br` (after DNS points at Contabo, or use `--webroot`/`--nginx` once resolvable).
11. Repo checkout: `git clone` `origin/main` @ `2d4909e` to `/opt/looply`; `npm run install:all`.
12. Directories/permissions: `frontend/dist`, `.backups` (gitignored), `umask 077` for backups.
13. Secrets: write `.env` from external/manual store (names per §8; never from a committed source).
14. PM2/systemd: `pm2 start ecosystem.config.cjs`, `pm2 save`, `pm2 startup systemd`.
15. Health checks: `/health` 200, `/health/ready` 200, frontend `dist` served, `/looply-media/` proxy OK.
16. Backup tooling: copy `ops/backup/*` (already in repo) + run a fresh backup/verify on Contabo.
17. Configure off-host DR (B2) — still PARTIAL, not cleared (see Risks).

## 18. Migration runbook (R2.M3/M4) — not executed now

```
PREPARE
  - Provision + fully configure Contabo (checklist §17), deploy code @ 2d4909e, build frontend+backend.
  - Reduce DNS TTL on looply.verbumlab.com.br to ~300s (>=24h before).
  - Establish rsync/ssh transfer path old→Contabo.
  GATE: Contabo `/health` 200 + `/health/ready` 200 + build clean + verify.sh on a fresh backup.

FREEZE WRITES
  - pm2 stop looply-backend on old VPS (or read-only). Stop accepting new writes.
  GATE: no new requests accepted; last write time captured.

FINAL BACKUP
  - ops/backup/backup.sh on old VPS → latest set.
  GATE: verify.sh PASS (checksums, migrations, counts, 4 objects).

TRANSFER
  - rsync/scp the final .backups/<TS>/ set to Contabo.
  GATE: transferred set sha256 matches source (re-run verify.sh on Contabo).

RESTORE
  - On Contabo: restore.sh <set> to the new DB + bucket (cross-cluster RESTORE_TARGET_DB_URL,
    FORCE_DESTRUCTIVE only for the authoritative final restore, after an isolated proof).
  GATE: verify.sh PASS on Contabo (DB counts == source, 4 objects byte-identical).

CONFIGURE
  - Write Contabo .env (names §8, values from secret store).
  - Point STORAGE_PUBLIC_ENDPOINT/PUBLIC_APP_URL/FRONTEND_URL/VITE_API_URL at new host.
  - Re-point Meta/Gupshup webhook URLs if they differ (verify token matches).
  GATE: env validated (`env.ts` fail-fast), webhook URLs correct.

BUILD
  - npm run install:all; backend build; frontend build (frontend/dist).
  GATE: both builds exit 0.

START
  - pm2 start ecosystem.config.cjs on Contabo; nginx reload; certbot cert in place.
  GATE: `/health` 200, `/health/ready` 200, frontend loads, media URL loads.

VERIFY
  - Full smoke: login, dashboard, calendar, clients, team, content, media upload/download,
    public approval, WhatsApp/Gupshup webhook reachable.
  GATE: all smoke checks pass.

CUTOVER
  - Flip DNS A/AAAA record to Contabo IP; wait for TTL expiry; re-issue cert if needed.
  GATE: public https://looply.verbumlab.com.br resolves to Contabo; cert valid.

OBSERVE
  - Watch logs, /health/ready, error rates for the observation window (e.g. 24-72h).
  GATE: no regressions; providers still delivering.

ROLLBACK IF NEEDED
  - If validation fails BEFORE cutover: reverse DNS, resume old VPS (no Contabo writes yet → safe).
  - If after cutover: reverse DNS to old VPS only if no production writes lost (see §16).
```

`MIGRATION_RUNBOOK_STATUS: COMPLETE` (written, not executed).

## 19. Risks / blockers

**BLOCKER:**
- **B2 — off-host DR not proven.** Permanent off-host backup is still PARTIAL (R2.1B BLOCKED — no
  independent destination). **Not cleared.** This does NOT block the migration (the migration itself
  transfers a backup set to a new host), but permanent off-host DR must be configured on Contabo
  before release readiness.

**REQUIRED BEFORE CUTOVER:**
- Provision + configure Contabo per §17 and validate it (health/ready, build, restore drill).
- Reduce DNS TTL; arrange maintenance window; final write-stop + final backup + transfer + restore
  + verify proven ON Contabo.
- Nginx config + certbot + PM2 startup must be recreated on Contabo (they are out-of-repo host state).
- `.env` values re-provisioned on Contabo from external/manual store.
- Meta/Gupshup webhook URLs + verify tokens aligned for the new host.
- Enough RAM/CPU on Contabo (current 1vCPU/3.8Gi is tight).

**CAN FOLLOW AFTER MIGRATION:**
- Permanent off-host DR destination (B2) + scheduled backups + encryption-at-rest.
- Observability/alerting (B3), CI/security gates (B4) — existing release blockers, not migration-specific.
- Certbot auto-renew timer confirmation, log rotation, monitoring agents.

## Validation

- Read-only discovery only: `uname`, `/etc/os-release`, `free -h`, `df -h`, `timedatectl`, `node/npm/pm2 -v`, `pm2 jlist`, `ss -lntp`, `psql --version`/`pg_config`, `ps aux` (postgres), `docker ps`/`inspect`, `nginx -v` + config file read (not `-T` — certs root-only), `systemctl` (read-only), `openssl` (cert root-only → not readable), env var NAMES only (no values).
- Live checks: `/health`=200, `/health/ready`=200, MinIO bucket count=4, Redis `dbsize`=0, `aof_enabled:1`.
- No source modified, no infra changed, no DNS changed, no deploy, no commit, no push, no provider calls, no `.env` dump, no secrets printed, no containers started.

## Git state

```
HEAD:          2d4909e807c1443800b691fb85c0d043eea532df (unchanged, == origin/main)
Worktree:      clean (report only; no source changes)
Staged/Commit: none
KORE_TOUCHED:  NO
```

## Result

```
RESULT: COMPLETE
CURRENT_HOST: srv1843655 (Hostinger VPS)
OS: Ubuntu 24.04.4 LTS
CPU_RAM_DISK: 1 vCPU / 3.8Gi RAM / 48G disk (53% used)
NODE_VERSION: v24.18.0
PM2: 7.0.3 (looply-backend fork, systemd startup enabled)
POSTGRES: 16.14 (local service, 127.0.0.1:5432, DB looply, 15 migrations, R2.1 restore proven)
REDIS: 7.4.9 (docker, 127.0.0.1:6379, AOF on, empty transient store → no backup)
MINIO: minio/minio:RELEASE.2025-04-22T22-12-26Z (docker, 127.0.0.1:9100, bucket looply-media, 4 objects)
NGINX: 1.24.0 (root, static frontend/dist + /api/ + /looply-media/ S3 proxy)
TLS: Let's Encrypt via certbot 5.7.0 (cert not readable by non-root; auto-renew assumed)
DOMAINS: looply.verbumlab.com.br

DEPLOYMENT_AUTHORITY: GIT (code) + PM2 (process) + NGINX/systemd (host, out-of-repo) + .env (config)
PERSISTENT_STATE: PostgreSQL looply DB + MinIO looply-media (4) + repo + env/secrets (external)
SECRET_INVENTORY_STATUS: COMPLETE (names only, classified)
PUBLIC_PORTS: 80, 443, 22
LOCAL_ONLY_PORTS: 4000, 5432, 6379, 9100, 9101 (+ agent infra)

BACKUP_MIGRATION_PATH: READY
CONTABO_COMPATIBILITY: READY
DOWNTIME_STRATEGY: MAINTENANCE_WINDOW + WRITE_STOP + FINAL_BACKUP + DNS_TTL_REDUCTION + CUTOVER
ROLLBACK_STRATEGY: OLD_VPS_FROZEN + DNS_REVERSAL + NO_OLD_WRITES_AFTER_CUTOVER

MIGRATION_BLOCKERS: B2 (off-host DR PARTIAL, not cleared)
REQUIRED_BEFORE_CUTOVER: Contabo provisioning+validation, DNS TTL reduction, final backup+transfer+restore+verify on Contabo, nginx/certbot/PM2/.env recreation, webhook re-pointing
CAN_FOLLOW_AFTER_MIGRATION: B2 off-host DR, B3 observability, B4 CI gates, certbot timer/log rotation

CONTABO_PROVISIONING_PLAN: COMPLETE (17-step checklist §17)
MIGRATION_RUNBOOK_STATUS: COMPLETE

RELEASE_BLOCKER_B2: PARTIAL
SOURCE_CHANGED: NO
REPORT: .dev-reports/looply-v1-r2-m1-contabo-migration-readiness.md
GIT_STATE: clean @ 2d4909e, nothing staged/committed, KORE_TOUCHED: NO
NEXT_STATUS: READY_FOR_R2_M2_CONTABO_PROVISIONING
```

---

LOOPLY R2.M1 CONTABO MIGRATION READINESS — COMPLETE