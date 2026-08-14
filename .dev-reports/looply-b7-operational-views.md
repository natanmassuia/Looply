# Looply V1 — B7 Operational Views

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `6437ece`
- **B6 ancestry:** confirmada (`6437ece feat(v1): add jobs workflow and activity`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B7 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Existing Query Inventory

Antes da B7:

- `GET /api/jobs` retornava todos os Jobs tenant-scoped, sem filtros, paginação ou metadata de página.
- `GET /api/workflows` e `GET /api/workflows/:id` já retornavam Workflow/Stages.
- `POST /api/jobs/:id/transition` era o único write path de Stage.
- Não existiam board projection ou summary counts.
- `jobService.listJobs` carregava Client/Workflow/Stage mínimos, mas não limitava resultado.
- `dashboardService` possui aggregates globais e permanece B11.
- Frontend callers foram apenas inspecionados; nenhum foi alterado.

## Architecture Decision

Kanban é uma projeção read-only de `WorkflowDefinition + WorkflowStage + Job.currentStageId`. Nenhuma tabela `KanbanBoard`, `KanbanColumn`, `KanbanCard`, posição manual ou estado duplicado foi criado.

## Schema Changes

Nenhuma migration ou alteração de schema foi criada na B7. Os índices B6/B5 existentes cobrem Company, Client, Workflow e Stage.

## List Contract

`GET /api/jobs` agora retorna:

- `jobs`;
- `total`;
- `page`;
- `limit`;
- `pages`.

Cada item possui apenas dados necessários para uma lista/card futuro: Job básico, Client mínimo, lifecycle/status legacy, Workflow mínimo, Stage atual e timestamps.

## Filters

Filtros implementados:

- `clientId`;
- `workflowId`;
- `stageId`;
- `lifecycleStatus`;
- `search` em Job title e Client name.

Todos incluem `companyId` do auth context.

## Sorting

Whitelist:

- `updatedAt` (default);
- `createdAt`;
- `title`.

Direction: somente `asc`/`desc`. Nenhum column name arbitrário chega ao Prisma.

## Pagination

- page default: 1;
- limit default: 50;
- limit máximo: 100;
- offset simples (`skip/take`).

Não foi criado cursor framework.

## Board Contract

`GET /api/jobs/board` retorna:

- Workflow ativo;
- stages ordenados;
- Jobs agrupados por `currentStageId`;
- count por stage;
- `unassignedCount` explícito.

Opcionalmente aceita `workflowId`, sempre tenant-scoped.

## Projection Strategy

Board executa uma query de Workflow e uma query de Jobs com select mínimo. O agrupamento ocorre em memória; não existe query por stage ou por card. Board é read-only.

## Counts

`GET /api/jobs/summary` retorna:

- `byStage` via `groupBy(currentStageId)`;
- `byLifecycle` via `groupBy(lifecycleStatus)`.

Ambas as agregações filtram `companyId`.

## Capability Enforcement

- List: `JOBS`.
- Board: `JOBS + WORKFLOW + KANBAN`.
- Summary: `JOBS + WORKFLOW`.
- Activity history: `JOBS + ACTIVITY`.

MARKETING_AGENCY pode acessar board. LOCAL_BUSINESS e HIGH_TICKET mantêm list/summary, mas recebem 403 no board porque não possuem KANBAN no registry B3.

## Template Behavior

Nenhuma rota usa `if template === ...`. O comportamento é resolvido pela capability registry já existente. Os três templates continuam usando o mesmo motor Job/Workflow.

## Transition Relationship

Board não escreve Stage. O frontend futuro deve chamar `POST /api/jobs/:id/transition`; essa operação atualiza `currentStageId` e cria Activity atomicamente. Depois, o frontend pode refazer a projeção board.

## Query Efficiency

- List: count + findMany paralelos; page limitado a 100.
- Board: uma query de Workflow + uma query de Jobs.
- Summary: dois groupBy paralelos.
- Sem N+1 por Stage, Job ou Client.
- Card projection não carrega Activity, versões, Approval ou media completa.

## Index Review

Reutilizados:

- `Job.companyId`;
- `Job.clientId`;
- `Job.workflowId`;
- `Job.currentStageId`;
- `Job.status`;
- `Client.companyId`;
- unique `WorkflowDefinition.companyId`;
- unique/index `WorkflowStage.workflowId`.

Nenhum índice especulativo foi adicionado.

## Cross-Tenant Tests

- List A/B sem overlap.
- Search/status/list filters tenant-safe.
- Board Job grouping tenant-safe.
- Foreign Workflow → 404.
- Foreign Stage → 404.
- Summary não mistura tenants.
- `companyId` em query/body não altera tenant.
- Unauthenticated → auth gate.

## Capability Tests

- MARKETING_AGENCY board → 200.
- HIGH_TICKET board → 403 por ausência de KANBAN.
- List de HIGH_TICKET permanece disponível.
- Workflow/summary continuam protegidos por WORKFLOW.

## Security Audit

`.dev-reports/security-audit-b7-2026-08-14.md`:

- Critical: 0
- High: 0
- Medium: 0
- Low: 1 (board completo sem paginação, risco de volume documentado).

Nenhum finding B7 bloqueante.

## Performance Review

`.dev-reports/performance-audit-2026-08-14.md`:

- List bounded to 100.
- Board sem N+1.
- Summary usa groupBy.
- Risco residual: board completo sem windowing para tenants grandes; deferred until measured.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (110/110, 14 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

Tenant Agency A:

- `GET /api/jobs` → 200.
- `GET /api/jobs/board` → 200.
- Board retorna stages ordenados e Jobs em seus stages.

Tenant High Ticket B:

- `GET /api/jobs` → 200.
- `GET /api/jobs/board` → 403 por KANBAN ausente.

Transition continua sendo o write path e os testes confirmam Activity/refresh behavior.

## Code Review

1. Nenhum modelo ou tabela Kanban foi criado.
2. Board é somente projeção; nenhuma mutation foi adicionada ao board.
3. Sort e pagination são whitelistados/bounded.
4. Board/summary aplicam capabilities corretas.
5. Queries não fazem N+1 por stage/card.
6. Nenhuma alteração frontend ou captura de dirty file ocorreu.

## Changed Files

- `backend/src/services/jobService.ts`
- `backend/src/routes/jobs.ts`
- `backend/tests/jobsWorkflow.test.ts`
- `docs/engineering/08-operational-views.md`
- `.dev-reports/looply-b7-operational-views.md`
- `.dev-reports/security-audit-b7-2026-08-14.md`
- `.dev-reports/performance-audit-2026-08-14.md`

**Schema: unchanged. Frontend: zero changes.**

## Preexisting Dirty Files

Todos os arquivos frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Board não possui windowing/paginação por stage.
- Kanban UI e drag-and-drop não existem.
- Dashboard é B11.
- Files, Approval e Calendar são B8/B9/B10.
- Legacy `/api/contents/board` não existe por decisão explícita.

## Risks

- Board completo pode exigir limite/windowing quando o volume real crescer.
- `Content`/Job legacy bridge ainda carrega campos antigos de social media.

## Deferred to B8

- Files.
- Object storage.
- Attachment ownership.
- Presigned upload/download.

## Suggested Commit

`feat(v1): add operational job projections`

## Next Battery

B8 — Files
