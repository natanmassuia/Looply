# A3.0.1 — Runtime Readiness

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| HEAD at start | `e86b7cb92c7d00bb945ecf52b2c9b14d7ee95a2b` (unchanged) |
| Frontend dirty staged | NO |
| Backend baseline | 235 tests |
| Frontend baseline | 32 tests |

## Database Target

| Field | Value |
|---|---|
| DB_HOST_CATEGORY | local |
| DB_HOST_NAME | 127.0.0.1 |
| DB_PORT | 5432 |
| DB_NAME | looply |
| DB_SCHEMA | public |
| ENVIRONMENT | staging/dev (local DB on the staging box; `.env` `NODE_ENV=production` is only the PM2 build-mode flag) |

Target proof: the database is the same local instance the backend test suite mutates (235 tests ran against it), matching `.env.example`'s documented local dev database. No remote host, no credentials printed.

## Migration Review

`backend/prisma/migrations/20260820100000_whatsapp_actor_identity/migration.sql` is additive only: one `CREATE TABLE WhatsAppIdentity`, one unique index `(provider, phoneNumber)`, two secondary indexes, two FKs (`User`, `Company`, both `ON DELETE CASCADE`). No DROP, no ALTER of `Client`/`User`/`CompanyMember`, no data rewrite. `prisma:validate` PASS.

## Migration Application

Applied via canonical `npm --prefix backend run prisma:migrate:deploy` (task-authorized; no reset/dev/db push/db execute/psql). Output: only `20260820100000_whatsapp_actor_identity` applied.

## Migration Status

`prisma migrate status`: "Database schema is up to date!" — 10 migrations found, zero pending, zero failed, no divergence.

## WhatsAppIdentity Verification

Read-only `information_schema`/`pg_indexes`/`pg_constraint` checks (structure only, no user data dumped): all 9 expected columns present; unique index `WhatsAppIdentity_provider_phoneNumber_key` present; `companyId`/`userId` indexes present; both FKs present. Persistence smoke: a transactional create + unique lookup + deliberate rollback against an existing active membership — created and queried inside the transaction, nothing persisted after rollback.

## Redis Discovery

| Question | Answer |
|---|---|
| REDIS_RUNTIME_ALREADY_PRESENT | NO (no binary, no service, no 6379 listener; Kore's `kore-workspace-redis` on `127.0.0.1:3579` exists but is untouched and NOT reused) |

## Redis Runtime

Provisioned `looply-redis` — an isolated Docker container (`redis:7-alpine`, AOF persistence `--appendonly yes`, `--restart unless-stopped`), the smallest mechanism available on this host (no sudo; Docker already orchestrates services here). Single basic instance: no cluster, no sentinel, no streams, no BullMQ.

## Redis Exposure

Bound to `127.0.0.1:6379` only (verified via `docker ps` port mapping and `ss -tln`: listener on 127.0.0.1, not 0.0.0.0). No public exposure. No auth password required because the listener is loopback-only and host access is controlled.

## REDIS_URL

REDIS_URL_CONFIGURED=YES — set to the loopback address of `looply-redis` in the gitignored `/opt/looply/.env` (verified ignored via `git check-ignore`). Never echoed in full, never committed, never logged.

## Transient Store Smoke

Against the real runtime Redis using the application's `RedisTransientStore`: SET/GET round-trip PASS; TTL configured (≈30s observed) PASS; SET NX EX first claim true PASS; duplicate claim false PASS; GETDEL returns value once then null PASS. All keys synthetic (`looply:a3-runtime-smoke:*`) and deleted afterwards (verified zero leftovers).

## Confirmation Smoke

Synthetic company/user ids: `savePendingConfirmation` → read back exact command + correlation id PASS; `consumePendingConfirmation` returned the command exactly once PASS; second consume returned empty PASS. No Assistant command executed, no Appointment/Job created.

## Idempotency Smoke

Synthetic provider/message ids: first `claimInboundMessage` true PASS; repeat false PASS; independent id true PASS. No provider calls, no messages sent.

## Backend Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 235 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS |

## Frontend Regression

| Command | Result |
|---|---|
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

## Security Audit

| Check | Result |
|---|---|
| DB target verified local staging/dev | PASS |
| Migration additive only | PASS |
| Redis not publicly exposed (127.0.0.1 only) | PASS |
| REDIS_URL not committed / not printed | PASS (gitignored) |
| Redis/Kore isolation (no shared instance) | PASS |
| No process-memory fallback introduced | PASS (store layer only) |
| No credentials in output/history | PASS |
| No production access | PASS |
| Critical / High | 0 / 0 |

## Git State

Zero application code changes; zero source-controlled runtime config changes (`ecosystem.config.cjs` untouched; Redis is a host Docker container; `REDIS_URL` lives in gitignored `.env`). Only new documentation artifacts were committed in isolation. Pre-existing dirty/untracked files untouched; FRONTEND_DIRTY_STAGED=NO.

## A3.1 Readiness

YES. Migration applied, WhatsAppIdentity persisted and queryable, isolated Redis live with GETDEL/SETNX/TTL proven, confirmation and idempotency stores working against the real runtime. No webhook code exists yet. Note: no backend restart was needed because no running code consumes `REDIS_URL` yet; A3.1 must wire `transientStoreFromEnv(env.REDIS_URL)` and restart the Looply staging backend through its PM2 flow when it does.
