# Looply V1 — B6 Jobs + Workflow + Activity

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `c9b8f06`
- **B5 commit:** `c9b8f06 feat(v1): make clients tenant scoped`
- **B5 ancestry:** confirmada.
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B6 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Content Domain Inventory

Antes da B6:

- Prisma model `Content` físico com 8 rows.
- `ContentVersion` com 10 rows.
- `Approval` com 36 rows.
- Client relation via `clientId`.
- Status detalhado `DRAFT`, `IN_REVIEW`, `AWAITING_CLIENT`, `CHANGES_REQUESTED`, `APPROVED`, `SCHEDULED`, `PUBLISHED`.
- Parent/children grouping.
- Media/caption/version fields.
- publication/scheduled/published date fields.
- Approval relation preservada.
- Workflow transition rules em `domain/workflow.ts`.

## Direct Caller Inventory

| Caller | B6 result |
|---|---|
| `contentService.ts` | Adaptado para delegate Prisma `job`, tenant scope e legacy bridge |
| `routes/contents.ts` | Mantido como adapter, `JOBS` capability + `req.auth.companyId` |
| `approvalService.ts` | Relação preservada; physical Content/Version mapping continua compatível |
| `dashboardService.ts` | Adaptado de `content` para `job`; tenant dashboard completo deferred B11 |
| `seed.ts` | Adaptado para `job`/`jobVersion` |
| `routes/publications.ts` | Tenant-scoped legacy bridge + JOBS capability |
| frontend callers | Read-only inspection; zero alterações |

Repository-wide search não encontrou `prisma.content`, `db.content`, `prisma.contentVersion` ou `db.contentVersion` após a implementação.

## Existing Data Analysis

Snapshot antes da migration:

- Companies: 5
- Clients: 7
- Contents: 8
- ContentVersions: 10
- Approvals: 36

Todos os Contents possuíam Client válido. B5 já havia tornado `Client.companyId` obrigatório, permitindo backfill determinístico de Job ownership.

## Architecture Decision

Opção C: nomes canônicos `Job`/`JobVersion` no Prisma e no novo domínio, com `@@map("Content")`/`@@map("ContentVersion")` para preservar tabelas, IDs e relações físicas. `/api/jobs` é a API canônica. `/api/contents` é bridge legacy explícito, sem segunda persistência.

## Content → Job Strategy

Não houve DROP, cópia de rows, troca de IDs ou duplicação de domínio. O rename é lógico no código e seguro no banco. Approval mantém colunas físicas `contentId`/`contentVersionId`, mas as relações Prisma apontam para `Job`/`JobVersion`.

## Schema Changes

- `Job` mapeia a tabela física `Content`.
- `JobVersion` mapeia `ContentVersion`.
- `Job.companyId` obrigatório.
- `Job.lifecycleStatus` separado do status legacy.
- `Job.workflowId` e `Job.currentStageId`.
- `WorkflowDefinition` tenant-owned, unique por Company.
- `WorkflowStage` ordenado por workflow.
- `Activity` tenant-owned, ligada a Job e actor opcional.
- Enums `JobLifecycleStatus` e `ActivityType`.

## Migration Plan

Migration `20260816100000_jobs_workflow_activity`:

1. Criar enums.
2. Adicionar colunas Job nullable/default.
3. Backfill `Content.companyId` a partir de `Client.companyId`.
4. Abortar se houver órfão.
5. Aplicar NOT NULL/FKs/índices.
6. Criar WorkflowDefinition/Stage/Activity.
7. Bootstrap default workflows para Companies configuradas.
8. Associar Jobs existentes ao primeiro Stage.

## Migration Result

- `prisma migrate deploy`: PASS.
- `prisma generate`: PASS.
- Schema diff pós-migration: empty migration.
- Jobs: 8 preservados.
- JobVersions: 10 preservados.
- Approvals: 36 preservados imediatamente após migration.
- Job órfãos: 0.
- Workflows: 2.
- Stages: 8.
- IDs e Client relations preservados.

## Job Model

Job mantém dados úteis do Content legado, adicionando ownership, lifecycle macro e workflow state. O antigo `status` é mantido para compatibilidade do bridge Approval/publication; novas operações usam também `lifecycleStatus` e `currentStageId`.

## Tenant Ownership

`companyId` deriva de `req.auth.companyId` e é obrigatório. `clientId` é resolvido dentro da mesma Company. `workflowId`/`stageId` são validados contra Company e workflow do Job.

## Client Relationship

Create/update Job rejeitam Client de outro tenant com 404. Body `companyId` é ignorado. Não existe fallback para Company default.

## Job CRUD

- `GET /api/jobs`
- `GET /api/jobs/:id`
- `POST /api/jobs`
- `PATCH /api/jobs/:id`
- `POST /api/jobs/:id/transition`
- `GET /api/jobs/:id/activity`

Sem hard delete nesta bateria; cancelamento é lifecycle status.

## Job Status

Macro lifecycle: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

Stage representa posição no workflow e não altera automaticamente o lifecycle macro.

O status Content legado permanece para Approval/publication compatibility.

## Workflow Model

Um WorkflowDefinition default por Company configurada. Stages pertencem ao workflow e são ordenados por `position`.

## Workflow Stages

- LOCAL_BUSINESS: Novo, Em andamento, Concluído.
- HIGH_TICKET: Novo, Em andamento, Revisão, Concluído.
- MARKETING_AGENCY: Backlog, Em produção, Revisão, Concluído.

## Template Defaults

Definidos em `src/domain/jobWorkflow.ts`, sem `if template` espalhado em routes/services.

## Bootstrap Behavior

`ensureDefaultWorkflow(companyId)` é idempotente, protegido por unique Company, resolve corridas de primeira criação e rejeita Company sem template ativo.

## Transition Rules

`POST /api/jobs/:id/transition` aceita `{ stageId }`, exige Job/Workflow/Stage do mesmo tenant, Stage ativo e destino diferente. Qualquer Stage ativo do workflow é válido; não há adjacency matrix.

## Activity Model

`Activity` possui `companyId`, `jobId`, `actorUserId?`, `type`, `metadata?`, `createdAt`. Types: `JOB_CREATED`, `JOB_UPDATED`, `JOB_STAGE_CHANGED`, `JOB_COMPLETED`, `JOB_CANCELLED`.

## Transaction Boundaries

Job creation + Activity e transition + Activity usam a mesma Prisma transaction. Testes de rollback simulam falha do Activity insert e confirmam que Job/stage não permanecem parcialmente atualizados.

## Capability Enforcement

- Jobs: `Capability.JOBS`.
- Workflow list/detail e transition: `Capability.WORKFLOW`.
- Activity list: `Capability.ACTIVITY`.
- Legacy contents/publications: `Capability.JOBS`.

## Role Behavior

OWNER/ADMIN/MEMBER podem operar Jobs. Não foi criado RBAC adicional. Configuração administrativa de workflow ficou fora do mínimo B6.

## Legacy Compatibility

`/api/contents` e `/api/publications` continuam temporariamente disponíveis, mas usam delegates `job`, são tenant-scoped, exigem JOBS capability e não possuem persistência paralela. Novas integrações devem usar `/api/jobs`.

## Approval Relation

Approval não foi funcionalmente refatorado. IDs/colunas/links foram preservados para B9. Public approval paths continuam explicitamente fora do hardening tenant-aware de B6.

## Cross-Tenant Tests

- A lista somente Jobs A; B somente Jobs B.
- A acessa Job B → 404.
- A anexa Client B → 404.
- Body `companyId=B` não muda ownership.
- A não atualiza Job B nem move Client para B.
- Workflow/Stage B não são aceitos por A.
- Activity B não lê Job A.
- Actor é `req.auth.userId`.

## Transaction Tests

- Falha em `JOB_CREATED` Activity reverte criação do Job.
- Falha em `JOB_STAGE_CHANGED` Activity reverte mudança de Stage.
- Smoke real confirmou create/transition/activity.

## Security Audit

`.dev-reports/security-audit-b6-2026-08-14.md`:

- Critical: 0
- High: 0
- Medium: 0
- Low: 2, ambos deferred (Approval público B9 e Dashboard B11).

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (108/108, 14 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` | 0 | PASS |
| `prisma generate` | 0 | PASS |
| `prisma migrate diff` pós-migration | 0 | PASS (empty migration) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

Tenant A/B login, workflow list por template, create Job com Client próprio, Client estrangeiro → 404, Activity `JOB_CREATED`, cross-tenant Job/Activity → 404, transition válida → Activity `JOB_STAGE_CHANGED`, Stage estrangeiro → 404, listagem sem overlap. PASS.

## Code Review

1. Prisma model rename inicialmente quebrou delegates antigos; todos os callers foram migrados para `job`/`jobVersion`.
2. Legacy `/api/contents` inicialmente poderia bypassar workflow/activity; foi mantido como bridge tenant-scoped e passou a bootstrapar workflow + `JOB_CREATED`.
3. Capability JOBS/WORKFLOW/ACTIVITY aplicada nos boundaries corretos.
4. Transaction tests adicionados para falhas de Activity.
5. Nenhuma implementação de Kanban, Files, Approval, Calendar, Dashboard visual ou frontend.

## Changed Files

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260816100000_jobs_workflow_activity/migration.sql`
- `backend/src/domain/jobWorkflow.ts`
- `backend/src/services/workflowService.ts`
- `backend/src/services/jobService.ts`
- `backend/src/services/activityService.ts`
- `backend/src/routes/jobs.ts`
- `backend/src/routes/workflows.ts`
- `backend/src/routes/contents.ts`
- `backend/src/routes/publications.ts`
- `backend/src/services/contentService.ts`
- `backend/src/services/approvalService.ts`
- `backend/src/services/dashboardService.ts`
- `backend/src/seed.ts`
- `backend/tests/contentService.test.ts`
- `backend/tests/jobsWorkflow.test.ts`
- `backend/tests/jobsAtomic.test.ts`
- `docs/engineering/07-jobs-workflow-activity.md`
- `.dev-reports/looply-b6-jobs-workflow-activity.md`
- `.dev-reports/security-audit-b6-2026-08-14.md`

**Frontend: zero changes.**

## Preexisting Dirty Files

Todos os reports/frontend preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Approval public-token tenant hardening pertence à B9.
- Files/storage pertence à B8.
- Calendar pertence à B10.
- Dashboard tenant aggregates pertence à B11.
- Legacy social-media fields permanecem para compatibilidade incremental.
- CSRF/rate-limit hardening pertence à B12.

## Risks

- A tabela física ainda se chama `Content` por compatibilidade de migration/Approval; o domínio canônico de código é `Job`.
- `/api/contents` continua disponível como bridge temporário e deve ser removido quando o frontend Figma consumir `/api/jobs`.

## Deferred to B7

- Kanban.
- Operational views.
- Template-aware views.
- Frontend Figma integration.

## Suggested Commit

`feat(v1): add jobs workflow and activity`

## Next Battery

B7 — Operational Views / Kanban Foundation
