# Looply V1 — B3 Workspace Templates + Capability Registry

## Baseline
- **Branch:** `feature/demo-v1-polish`
- **SHA inicial:** `9f02204` (= B2 commit 9f02204)
- **B0:** 1971983 · **B1:** 66b1630 · **B2:** 9f02204
- **Dirty worktree (preexistente, preservado):** `.dev-reports/looply-contents-card-grouping.md`, `backend/src/routes/team.ts`, `backend/src/services/teamService.ts`, 13 arquivos frontend, untracked (reports demo, `.env.backup`, `ecosystem.config.cjs`, `package-lock.json`). Nenhum arquivo da B3 tinha diff preexistente → zero sobreposições.

## Skills / MCPs
- `caveman`, `kore-validate`, `kore-report`, `security-audit` (conteúdos já em contexto da sessão). "implement"/"code-review" não existem como skills — code review manual executado sobre o diff B3.

## Architecture Decision
- Enum `WorkspaceTemplate` nullable em `Company` + registry em código (`domain/capabilities.ts`). Sem tabela de templates, sem linha por capability, sem overrides por cliente. Templates = comportamento de produto versionado (Verbum Lab). `null` = UNCONFIGURED (prepara onboarding B4).

## Schema Changes
- `enum WorkspaceTemplate { LOCAL_BUSINESS, HIGH_TICKET, MARKETING_AGENCY }`; `Company.workspaceTemplate WorkspaceTemplate?` (nullable).
- Migration `20260814100000_workspace_templates` — aditiva (CREATE TYPE + ADD COLUMN). Existing companies → `null` (UNCONFIGURED), sem inferência silenciosa; demo seed seta `MARKETING_AGENCY` (evidência: dados demo modelam agência).

## Templates
LOCAL_BUSINESS ("apertar um botão e funcionar"), HIGH_TICKET (qualidade/aprovação/handoff), MARKETING_AGENCY (controle e escala).

## Capability Registry
`enum Capability` (9: CLIENTS, JOBS, WORKFLOW, KANBAN, FILES, APPROVAL, CALENDAR, ACTIVITY, DASHBOARD) + `TEMPLATE_REGISTRY` type-safe com cópias defensivas.

## Capability Matrix
Conforme docs/engineering/04 (igual ao baseline do briefing; sem divergências). LOCAL ⊂ HIGH_TICKET ⊂ MARKETING_AGENCY.

## Resolver
`capabilitiesForTemplate` / `hasCapability` / `resolveWorkspaceContext` — determinísticos; `null` → `[]` (nunca fallback permissivo).

## Guard
`requireCapability(cap)` — lê apenas `req.auth.companyId`; ausente → 403. Primitive criado; não aplicado a rotas atuais (evitar antecipar B4/B5).

## API Contract
`GET /api/auth/me` += `workspace { id, name, template, capabilities, status }`. Sem endpoint novo; frontend não consome ainda.

## Unconfigured Workspace
`null` template → status `UNCONFIGURED`, zero capabilities, guard nega (403) mesmo para OWNER.

## Tests
`tests/capabilities.test.ts` (17): registry exato por template, null→vazio, cópia defensiva, contexto UNCONFIGURED/ACTIVE, guard (permite/nega/unconfigured/sem auth), role não altera capability, tenant A não resolve B, spoof de body `companyId`/`capabilities` inerte.
Total backend: 67/67 (8 files). Frontend: 5/5 (intocado).

## Cross-Tenant Tests
Guard só lê auth context; DB fake contendo só company B com auth de A → 403 ✓; spoof probe com `companyId`/`capabilities`/`templateCapabilities` no body → 403 ✓.

## Security Audit
`.dev-reports/security-audit-b3-2026-08-14.md` — 0 critical/high/medium; 1 low (DB read por request no guard, sem cache — aceitável V1); 2 info.

## Validation
| Command | Exit | Result |
|---|---|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (67/67) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` | 0 | PASS (aditiva aplicada) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |
| Smoke curl `/api/auth/me` (workspace block, capabilities reais) | — | PASS |

## Migration Result
Aplicada via `migrate diff` → `migrate deploy` (mesmo workflow aprovado da B2; shadow DB sem permissão). Prisma Client gerado. Rollback não definido (documentado).

## Code Review (manual)
1. `Company.id` tipado `String?` por engano no edit inicial → corrigido antes do migrate.
2. Teste com `keys.sort()` mutando array (assertion falsa) → reescrito com sets explícitos.
3. Sem plugin framework, sem DB rows de capability, sem overrides, sem frontend, sem magic strings (enum), sem antecipação de Workflow/Onboarding. Resolvido.

## Changed Files (B3)
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260814100000_workspace_templates/migration.sql` (novo)
- `backend/src/domain/capabilities.ts` (novo)
- `backend/src/middleware/requireCapability.ts` (novo)
- `backend/src/routes/auth.ts` (me += workspace)
- `backend/src/seed.ts` (demo company template)
- `backend/tests/capabilities.test.ts` (novo)
- `docs/engineering/04-workspace-templates-capabilities.md` (novo)
- `.dev-reports/looply-b3-workspace-templates-capabilities.md` (novo)
- `.dev-reports/security-audit-b3-2026-08-14.md` (novo)

**Frontend: ZERO mudanças.**

## Preexisting Dirty Files
Todos preservados sem alteração; nenhum no stage.

## Risks
- Rotas de domínio atuais ainda sem capability guard (gap conhecido, B4/B5+).
- Guard sem cache (1 DB read/request).
- Template change pós-ativação ainda não governado (B4+).

## Deferred to B4
- Provisioning (User/Company/credencial temporária); forced password change; company details; onboarding state machine; template selection UX; members; invitations; template governance endpoint.

## Suggested Commit
`feat(v1): add workspace templates and capabilities`

## Next Battery
B4 — Provisioning + First-Login Guided Onboarding + Members
