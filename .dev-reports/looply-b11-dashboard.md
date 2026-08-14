# Looply V1 — B11 Dashboard by Template

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `1e9593f`
- **B10 ancestry:** confirmada (`1e9593f feat(v1): add tenant safe calendar projection`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B11 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Existing Dashboard Inventory

Antes da B11, `dashboardService` retornava counts legacy e recent Jobs, mas executava aggregates sem `companyId`:

- Job status groupBy global;
- total Jobs global;
- total Clients global;
- total Users global;
- awaiting/changes global;
- recent Jobs globais.

## Global Aggregate Inventory

| Aggregate | Antes | Depois |
|---|---|---|
| Job status groupBy | Global | `where companyId` |
| Job count | Global | `where companyId` |
| Client count | Global | `groupBy status + companyId` |
| User/team count | Global User count | active CompanyMember count |
| Approval count | inexistente no Dashboard | capability-gated + companyId |
| Activity recent | inexistente | capability-gated + companyId + take 10 |
| Calendar upcoming | inexistente | capability-gated, fixed 7-day range |

Nenhum aggregate global permanece no Dashboard.

## Architecture Decision

Dashboard permanece uma projeção sem persistência, sem cache, sem warehouse e sem materialized view.

## Dashboard Contract

`GET /api/dashboard` retorna workspace/capabilities/availableSections, summary, attention, upcoming opcional, recent e campos legacy compatíveis.

## Metric Definitions

- Clients ativos: `Client.status=ACTIVE`, Company atual.
- Jobs open/inProgress/completed/cancelled: `Job.lifecycleStatus`, Company atual.
- Jobs total: soma dos lifecycle groups.
- Team active: `CompanyMember.isActive`, Company atual.
- Stage counts: `Job.currentStageId`, somente com WORKFLOW.
- Approval pending/changes: Approval atual, não expirada/revogada, somente com APPROVAL.

Não há overdue porque não existe dueAt genérico.

## Attention Definitions

- Jobs legacy `AWAITING_CLIENT` e `CHANGES_REQUESTED`, limite 10.
- Approvals PENDING/CHANGES_REQUESTED válidos, quando capability existe.
- Upcoming publicationTarget/scheduledAt nos próximos 7 dias, quando CALENDAR existe.

## Capability-Aware Sections

- base: summary/attention/recent;
- WORKFLOW: stages;
- KANBAN: board availability;
- APPROVAL: approval section/counts;
- CALENDAR: upcoming;
- ACTIVITY: recent activity.

Capabilities ausentes omitem a seção e impedem a query correspondente.

## Local Business Projection

Projeção simples sem Approval/Kanban: Clients ativos, Jobs lifecycle, atenção básica, upcoming e Activity.

## High Ticket Projection

Inclui Approval/review, upcoming, Activity, lifecycle e stages. Não inclui board/Kanban.

## Marketing Agency Projection

Inclui maior densidade operacional e anuncia seção board por possuir KANBAN, além de Approval, Calendar, Workflow e Activity.

Não existem code forks por template.

## Tenant Isolation

Dashboard route exige auth/workspace/DASHBOARD. Todas as queries usam `req.auth.companyId`. `companyId`, template e capabilities de query/body são ignorados.

## Client Metrics

`summary.clients.active` e `counts.totalClients` usam apenas Clients da Company atual.

## Job Metrics

`summary.jobs` usa lifecycleStatus. Campos legacy `counts` permanecem tenant-scoped para compatibilidade e não substituem o lifecycle macro.

## Stage Metrics

`summary.byStage` é consultado somente com WORKFLOW. Nomes de stages são resolvidos por WorkflowStage da Company.

## Approval Metrics

Approval counts só são consultados quando `APPROVAL` está nas capabilities. Expired/revoked não entram como atenção.

## Upcoming Projection

Usa o primitive Calendar B10 com janela fixa agora → +7 dias. Não aceita range arbitrário no Dashboard e não cria datas novas.

## Recent Activity

Quando ACTIVITY existe, retorna no máximo 10 rows, ordenados por createdAt desc, com type/job title/actor mínimo. GET não cria Activity.

## Query Strategy

Queries independentes usam `Promise.all`: client groupBy, lifecycle/status groupBy, member count, recent Jobs, attention Jobs e seções capability-aware. Não há loop com query por item.

## Index Review

Reutilizados índices já existentes. Nenhuma migration foi criada em B11.

## Cross-Tenant Tests

- Agency A só recebe métricas A.
- High Ticket B só recebe métricas B.
- `companyId` spoof permanece inerte.
- Unauthenticated → 401.
- Workspace incompleto permanece bloqueado pelo middleware global.

## Capability Tests

- Dashboard route exige DASHBOARD.
- Approval queries não executam em workspace sem APPROVAL (service fake spy).
- Agency anuncia board/KANBAN.
- High Ticket não anuncia board.

## Metric Tests

- Active Clients correto.
- Lifecycle Job counts tenant-safe.
- Approval counts bounded/capability-aware.
- Upcoming bounded a 7 dias.
- Activity bounded a 10.

## Security Audit

`.dev-reports/security-audit-b11-2026-08-14.md`:

- Critical: 0.
- High: 0.
- Medium: 0.
- Low: 0.

## Performance Audit

`.dev-reports/performance-audit-b11-2026-08-14.md`:

- Promise.all para seções independentes.
- Recent/attention/activity limitados.
- Sem storage/N+1.
- Um risco baixo de múltiplas queries paralelas, mantido por simplicidade.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (133/133, 18 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

- Agency A Dashboard → 200, somente dados A, approvals/upcoming/activity/board disponíveis.
- High Ticket B Dashboard → 200, somente dados B, approval/upcoming/activity disponíveis, sem board.
- companyId query spoof → inerte.
- Unauthenticated → 401.

## Code Review

1. Todos os aggregates globais foram substituídos por filtros Company.
2. Dashboard não possui persistência/cache/warehouse.
3. Approval/Calendar/Activity queries são capability-gated.
4. Nenhum overdue foi inventado a partir de createdAt.
5. Recent/attention sections possuem limites.
6. Nenhuma alteração frontend, Dashboard UI ou hardening geral foi feita.

## Changed Files

- `backend/src/services/dashboardService.ts`
- `backend/src/routes/dashboard.ts`
- `backend/tests/dashboard.test.ts`
- `docs/engineering/12-dashboard.md`
- `.dev-reports/looply-b11-dashboard.md`
- `.dev-reports/security-audit-b11-2026-08-14.md`
- `.dev-reports/performance-audit-b11-2026-08-14.md`

**Schema: unchanged. Frontend: zero changes.**

## Preexisting Dirty Files

Todos os frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Dashboard não é analytics/reporting platform.
- Sem overdue universal.
- Sem métricas de SLA/produtividade/conversão.
- Sem cache/materialized views.
- Hardening geral pertence à B12.

## Risks

- Dashboard executa múltiplas queries paralelas; todas são bounded/tenant-safe.
- Legacy `counts` coexistem com summary novo até migração frontend futura.

## Deferred to B12

- CSRF hardening.
- Public endpoint rate limiting.
- Nginx/public-token logging review.
- Abandoned upload cleanup.
- Attachment/storage reconciliation.
- Board/calendar pagination/windowing review.
- Legacy bridge boundaries.
- Package/security audit consolidation.
- Final module boundary audit.
- Final production/deployment readiness.

## Suggested Commit

`feat(v1): add tenant safe dashboard projections`

## Next Battery

B12 — Hardening + Module Boundaries
