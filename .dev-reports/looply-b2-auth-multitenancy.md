# Looply V1 — B2 Auth + Multi-tenancy

## Baseline
- **Branch:** `feature/demo-v1-polish`
- **SHA inicial:** `66b1630e1282d7ecdd234330f7c6c7a3216c3c3d` (= B1 commit 66b1630)
- **B0:** 1971983 · **B1:** 66b1630
- **Dirty worktree (preexistente, preservado):** `.dev-reports/looply-contents-card-grouping.md`, `backend/src/routes/team.ts`, `backend/src/services/teamService.ts`, 13 arquivos frontend (components/features/index.css/tailwind.config.js), untracked: reports demo, `.env.backup`, `ecosystem.config.cjs`, `package-lock.json`.
- **Sobreposição controlada:** `frontend/src/components/AppLayout.tsx` (diff preexistente de 1 linha preservado; B2 adicionou header de usuário + Sair). Nenhum outro arquivo sujo foi tocado. `backend/src/routes/team.ts` e `teamService.ts` (POST /api/team preexistente) **não** foram modificados pela B2 — agora protegidos por `requireAuth` no nível do app.

## Skills / MCPs
- `caveman`, `kore-validate`, `kore-report`, `security-audit` (carregadas). "implement" e "code-review" não existem como skills neste ambiente — code review executado manualmente sobre o diff da B2.

## Current Auth State (antes)
- `DEV_DEMO_USER` era apenas warning no startup — **não existia middleware de auth/bypass**; todas as rotas `/api/*` eram abertas. Frontend não buscava current user. `UserRole` enum de agência; sem Company/Membership/Session; sem passwordHash. `.env.example` referenciava `lib/devAuth.ts` inexistente.

## Architecture Decision
- **Sessão DB-backed + cookie httpOnly** (Option A). Motivos: revogação/logout imediato via DB, sem refresh tokens, sem Redis, frontend mínimo, testável. Token 256-bit; DB guarda sha256. Cookie httpOnly/SameSite=Lax/secure(prod)/7d. Detalhes em `docs/engineering/03-auth-multitenancy.md`.

## Schema Changes
- `User.passwordHash String?`; novos `Company`, `CompanyMember` (unique userId+companyId; índices), `Session` (id=sha256 token, índice userId), enum `MemberRole {OWNER,ADMIN,MEMBER}` (menor conjunto; gestão de membros expande em B3).
- FKs `ON DELETE RESTRICT`; migration **100% aditiva** (sem DROP/DELETE).

## Migration Result
- `prisma migrate dev` bloqueado (shadow DB: role sem CREATEDB) → SQL gerado via `prisma migrate diff` (from-url → to-schema), pasta criada manualmente, aplicada com `prisma migrate deploy`. Status: "Database schema is up to date!". Prisma Client gerado. **Rollback: não definido/testado** (limitação documentada; migration aditiva → rollback manual = drop das 3 tabelas + coluna).

## Implementation
| Area | Status |
|---|---|
| scrypt hash/verify + dummy-hash anti-timing | DONE |
| Session cookie helpers (httpOnly/Lax/secure/7d) | DONE |
| login/logout/me/switch-company + Zod | DONE |
| requireAuth (session→user→membership→company, revalidado/request) + requireRole | DONE |
| Muro de auth em `/api/*` (public/auth abertos) | DONE |
| Login rate limiter in-process (10/15min) | DONE |
| Cookie parser mínimo (sem cookie-parser dep) | DONE |
| Seed: company + memberships + senhas demo | DONE |
| Frontend: credentials, Login, ProtectedRoute, logout | DONE |
| DEV_DEMO_USER removido (env/server/.env.example/test) | DONE |

## DEV_DEMO_USER
Antes: flag de env + warning (sem bypass real). Depois: removido; substituto (sessão real) completo e verificado por curl E2E + testes antes da remoção.

## Tenant Trust Model
`req.auth = {userId, companyId, role}` derivado de session+membership revalidada por request; companyId de body nunca confiado (testado com probe).

## Frontend Changes
`lib/api.ts` (credentials + useMe/useLogin/useLogout), `features/Login.tsx` (+ProtectedRoute), `App.tsx` (rota /login + guard), `AppLayout.tsx` (header usuário + Sair — sobreposição documentada).

## Tests
Backend 50/50 (7 files): B1 suite adaptada (404/401) + `auth.test.ts` novo (21 testes: password, cookie flags, login, resolveAuth, cross-tenant, logout, limiter). Frontend 5/5 (intactos).

## Cross-Tenant Tests
- A→companyB e B→companyA: 403 ✓
- companyId no body não altera tenant context ✓
- membership inativa → 403/negado ✓ (login, resolveAuth, switch)
- sessão inválida/revogada/expirada/malformada → 401 ✓
- user inativo → negado ✓
- membership revogada mid-session → acesso cai imediatamente ✓

## Security Audit
`.dev-reports/security-audit-2026-08-14.md` — 0 critical / 0 high / 1 medium (CSRF: aceito com SameSite=Lax+CORS single-origin, revisitar B3+) / 2 low. Timing side-channel do login corrigido (dummy hash).

## Validation
| Command | Exit | Result |
|---|---|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (50/50) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` | 0 | PASS (aplicada) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |
| Smoke curl (login/me/switch/logout/401) no PM2 dev | — | PASS |

## Code Review (manual)
1. `/me` e `/switch-company` montados antes do requireAuth global → corrigido com `requireAuth` na rota.
2. Filtro Prisma `is_active` inválido → `isActive`.
3. cookieOptions lia snapshot de env → corrigido para leitura ao vivo.
4. Seed: role OWNER comparava chave vs email → corrigido.
5. Timing side-channel login → dummy hash.
6. Sem leaks de passwordHash/token em responses (testado); sem deps novas; sem arquivos não relacionados.

## Changed Files (B2)
- backend: `prisma/schema.prisma`, `prisma/migrations/20260814000000_.../migration.sql`, `src/lib/password.ts`, `src/lib/session.ts`, `src/lib/loginLimiter.ts`, `src/lib/errors.ts`, `src/lib/env.ts`, `src/middleware/requireAuth.ts`, `src/services/authService.ts`, `src/routes/auth.ts`, `src/app.ts`, `src/server.ts`, `src/seed.ts`, `tests/auth.test.ts`, `tests/env.test.ts`, `tests/health.test.ts`, `tests/foundation.test.ts`
- frontend: `src/lib/api.ts`, `src/App.tsx`, `src/features/Login.tsx`, `src/components/AppLayout.tsx` (overlap)
- root: `.env.example`, `docs/engineering/03-auth-multitenancy.md`, `.dev-reports/looply-b2-auth-multitenancy.md`, `.dev-reports/security-audit-2026-08-14.md`

## Preexisting Dirty Files
Preservados sem alteração (exceto AppLayout, sobreposição mínima documentada): team.ts, teamService.ts, 12 arquivos frontend, reports demo, `.env.backup`, `ecosystem.config.cjs`, `package-lock.json`.

## Risks
- CSUM: sem token CSRF explícito (documentado no audit).
- Limiter login in-process (restart limpa; single-node V1).
- Sessão sem sliding renewal (7d fixos).
- Rollback de migration não testado.
- PM2 dev local reiniciado para smoke test (não é produção).

## Known Gaps
- **Client/Content/Approval ainda NÃO tenant-scoped** — rotas exigem sessão, mas recursos não filtram por company. Isolamento completo acontece em B4/B5.
- `POST /api/team` (preexistente) sem checagem de role — B3.

## E2E
Formal waiver: não há harness E2E (sem Playwright/Cypress no repo). Fluxos críticos validados via curl contra o servidor real (login→me→switch→logout→401) + testes de integração supertest com fake DB.

## Deferred to B3
- Onboarding; invitations; accept-invite; gestão de membros com roles; workspace switch UX refinada; políticas de senha/reset.

## Suggested Commit
`feat(v1): add auth and multi-tenant foundation`

## Next Battery
B3 — Members + Onboarding
