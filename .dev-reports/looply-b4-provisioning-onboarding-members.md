# Looply V1 — B4 Provisioning + Onboarding + Members

## Baseline
- **Branch:** `feature/demo-v1-polish`
- **SHA inicial:** `8f43c0b` (= B3 commit 8f43c0b)
- **B0:** 1971983 · **B1:** 66b1630 · **B2:** 9f02204 · **B3:** 8f43c0b
- **Dirty worktree (preexistente, preservado):** 20 arquivos (report, team.ts, teamService.ts, 13 frontend, tailwind) + untracked (4 reports demo, .env.backup, ecosystem.config.cjs, package-lock.json). Nenhum arquivo B4 tinha diff preexistente → zero sobreposições.

## Skills / MCPs
- `caveman`, `kore-validate`, `kore-report`, `security-audit` (em contexto da sessão). "implement"/"code-review" inexistentes como skills — code review manual.

## Architecture Decisions
1. Provisioning via **CLI** (`scripts/provision.ts`) — sem endpoint HTTP, sem secrets expostos.
2. Estado: **flags/timestamps** (mustChangePassword, workspaceTemplate null, onboardedAt) em vez de enum. Status derivado: PASSWORD_CHANGE_REQUIRED → ONBOARDING_REQUIRED → ACTIVE.
3. Gating backend: `requirePasswordChanged` + `requireWorkspaceActive` montados em cascata no `/api` (auth/onboarding/invitations-accept fora).
4. Invitation: token 256-bit com **hash no DB** (mesmo padrão de session), single-use, 7d, revogável; accept = signup invitation-scoped (novo user) ou attach (user logado com e-mail igual).

## Public Signup Status
- NENHUM signup público. Users nascem só via provision CLI ou invitation token.
- **B4 FINAL REMEDIATION (commit `fix(auth): close legacy user creation path`):** `POST /api/team` legado (diff preexistente da worktree que criava Users arbitrários sem policy B4) foi neutralizado → **410 Gone** para qualquer role; `createTeamMember` removido do teamService; `GET /api/team` read-only preservado. Testes live-DB (`tests/legacyTeamDeprecation.test.ts`): OWNER/ADMIN/MEMBER → 410 sem criação (user.count inalterado); unauthenticated → 401. Diffs preexistentes dos arquivos team.ts/teamService.ts foram SUBSTITUÍDOS pela remediação (a mudança preexistente ERA o próprio caminho de criação não autorizado — remoção aprovada pelo briefing; nada do restante diff preexistente foi perdido).

## Schema Changes
- `User.mustChangePassword Boolean @default(false)`.
- `Company`: legalName?, document?, email?, phone?, website?, timezone (default America/Sao_Paulo), locale (default pt-BR), onboardedAt?.
- `Invitation` (id, companyId, email, role, tokenHash unique, invitedByUserId, expiresAt, acceptedAt?, revokedAt?, createdAt; índices companyId/email).
- Relations User ↔ InvitationSent.

## Provisioning
CLI cria User (senha temp 96-bit) + Company UNCONFIGURED + OWNER membership; imprime senha UMA vez.

## Temporary Credentials
Plaintext só no stdout do CLI no momento; hash scrypt no DB; nunca logado (redaction cobre password/token).

## First Login
Login com senha temp OK; `mustChangePassword=true` em login/me; `/api` normal → 403 até trocar.

## Password Change
`POST /api/auth/change-password`; policy ≥10 chars; revoga todas as sessões + nova sessão; senha antiga → 401.

## Onboarding State
`GET /api/onboarding/status`; estados como decidido; `readyToComplete` = senha ok + name + template.

## Company Data
`PATCH /api/onboarding/company` (name/timezone/locale obrigatórios; extras opcionais); bloqueado pós-ACTIVE.

## Template Selection / Activation
`POST /api/onboarding/template` (enum validado; 409 pós-ACTIVE). `POST /api/onboarding/complete` (idempotente; transacional). `requireWorkspaceActive` libera domínio só com onboardedAt+template.

## Members / Role Matrix
| Ação | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Listar members | ✓ | ✓ | ✗ |
| Alterar role/isActive | ✓ | ✗ | ✗ |
| Convidar MEMBER | ✓ | ✓ | ✗ |
| Convidar ADMIN | ✓ | ✗ | ✗ |
| Revogar convite | ✓ | ✓ | ✗ |

Last-OWNER ativo protegido (409). Cross-tenant → 404.

## Invitations / Accept
Conforme docs/engineering/05. Accept sem auth para user novo (token é a credencial); user existente exige sessão com e-mail igual; invalid/expired/revoked/replay → 400.

## Tenant Isolation
Invitations/members usam só `req.auth.companyId`; spoof de companyId/role no body inerte (padrão B2/B3 mantido); updateMember escopa por company (404).

## Security Audit
`.dev-reports/security-audit-b4-2026-08-14.md` — 0 critical/high/medium; 3 low documentados (accept-by-token by design; rate limit no accept → B11; token no response até haver delivery).

## CSRF Review
Reavaliado: novas mutations mantêm JSON+SameSite=Lax+CORS single-origin; sem nova superfície vs dívida B2. Decisão: manter documentado, revisitar no hardening (B11).

## Tests
Backend 87/87 (9 files): +`onboardingMembers.test.ts` (20): provisioning, onboarding state machine, password policy, members/roles/last-owner, invitations (criar/roles/duplicado/expira/revoga/accept novo+existente/replay/weak password/cross-tenant 404).

## Smoke Test (curl no PM2 dev)
PROVISION → LOGIN temp (mustChange:true) → /api/clients 403 → status PASSWORD_CHANGE_REQUIRED → change-password → senha antiga 401 → 403 onboarding → PATCH company → template → COMPLETE ACTIVE → tamper template 409 → /api/clients 200 → me ACTIVE/HIGH_TICKET → invite → accept (user novo) → member login, /api/members 403 (MEMBER) → OWNER lista 2 → replay 400. **Tudo verde.**

## Validation
| Command | Exit | Result |
|---|---|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (87/87) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` + generate | 0 | PASS (aditiva) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Migration
`20260814200000_provisioning_onboarding_members` — aditiva; backfill demo explícito (onboardedAt=now; mustChangePassword=false — demo operacional evidenciado). Rollback não definido.

## Code Review (manual)
1. Login response não expunha mustChangePassword → adicionado (com sessão rotacionada o sinal precisa vir no login e no /me).
2. `optionalAuth` com dynamic imports → simplificado.
3. provision.ts com imports fantasma → limpo.
4. Tipos Prisma (MemberRole/WorkspaceTemplate casts) → resolvidos nos tipos, sem strings soltas.
5. Sem UI, sem endpoint público de provisioning, sem plaintext persistido. Resolvido.

## Changed Files (B4)
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260814200000_.../migration.sql`
- `backend/src/services/onboardingService.ts` (novo), `backend/src/services/memberService.ts` (novo), `backend/src/scripts/provision.ts` (novo)
- `backend/src/middleware/requireAuth.ts` (+requirePasswordChanged), `backend/src/middleware/requireWorkspaceActive.ts` (novo)
- `backend/src/services/authService.ts` (mustChangePassword em resolveAuth/login), `backend/src/routes/auth.ts` (change-password, me/login flags)
- `backend/src/routes/onboarding.ts` (novo), `backend/src/routes/members.ts` (novo), `backend/src/routes/invitations.ts` (novo), `backend/src/app.ts` (wiring)
- `backend/tests/onboardingMembers.test.ts` (novo)
- `docs/engineering/05-provisioning-onboarding-members.md` (novo), `.dev-reports/looply-b4-*.md`, `.dev-reports/security-audit-b4-*.md`

**Frontend: ZERO mudanças.**

## Preexisting Dirty Files
Todos preservados; nenhum staged.

## Risks
- Invitation token retornado via API até existir delivery por e-mail.
- Sem rate limit no /invitations/accept (**B12 Hardening**).
- CSRF permanece dívida documentada (**B12 Hardening** — roadmap revisado: B11 = Dashboard por Template, B12 = Hardening + Module Boundaries).
- Troca de template pós-ACTIVE ainda sem operação governada.
- Frontend `useCreateTeamMember` (Team.tsx) agora recebe 410 ao tentar criar — comportamento controlado; UI de team será repensada no Figma (B5+/B12).

## Deferred to B5
- Client tenant migration (companyId em Client); operational client model; limpeza do POST /api/team; frontend Figma.

## Suggested Commit
`feat(v1): add provisioning onboarding and members`

## Next Battery
B5 — Clients
