# Looply V1 — B10 Calendar

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `9621cd9`
- **B9 ancestry:** confirmada (`9621cd9 feat(v1): add secure public approvals`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B10 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Existing Date/Time Inventory

- `publicationTarget`: planejamento editorial/publicação.
- `scheduledAt`: agendamento operacional.
- `publishedAt`: fato histórico.
- `createdAt`/`updatedAt`.
- Company possui `timezone` desde B4.
- Não existem `dueAt`, `dueDate`, `startAt`, `endAt` ou CalendarEvent.
- Não existe calendar service backend.
- `/api/publications` usa `scheduledAt`/`publicationTarget` como bridge legacy.

## Existing Data Analysis

- Jobs: 8.
- Jobs com `publicationTarget`: 6.
- Jobs com `scheduledAt`: 3.
- Jobs com `publishedAt`: 2.
- Nenhum valor temporal foi removido ou transformado.

## Architecture Decision

Calendar é projeção de Job. Não foi criado modelo `CalendarEvent`, agenda paralela, recorrência ou integração externa.

## Canonical Date Model

Campos existentes são reutilizados:

- `publicationTarget` → evento `PUBLICATION_TARGET`;
- `scheduledAt` → evento `SCHEDULED`;
- `publishedAt` fica fora do Calendar futuro principal.

## Legacy Date Strategy

Nenhuma migration. `/api/publications` continua compatível. Não houve duplicação entre `dueAt`, `dueDate` e `deadlineAt`.

## Schema Changes

Nenhuma alteração de schema foi criada em B10.

## Migration

Não aplicável. Schema diff permanece sincronizado; rows e valores legados foram preservados.

## Timezone Policy

DB/queries usam UTC via DateTime. API recebe ISO-8601. `Company.timezone` retorna no response, mas B10 não implementa conversão local complexa nem adiciona dependência de timezone.

## Range Semantics

Intervalo `[from, to)`: start incluído, end exclusivo. Range máximo de 90 dias. Datas inválidas, invertidas ou range excessivo → 400.

## Calendar API

`GET /api/calendar?from=...&to=...`

Filtros: `clientId`, `stageId`, `lifecycleStatus`.

Response: timezone, range UTC normalizado, events, totalEvents e truncated.

## Event Projection

Eventos contêm id, jobId, type, at, title, Client mínimo, lifecycleStatus e Stage mínimo. Não carregam Activity, Approval, Files, versões ou media.

## Event Types

- `PUBLICATION_TARGET`.
- `SCHEDULED`.

Job com ambas as datas aparece duas vezes com types distintos.

## Filters

Client e Stage são validados no tenant atual. `companyId` query/body não é autoridade. Search não foi adicionado.

## Result Limits

- range máximo: 90 dias;
- query cap: 501 Jobs;
- response cap: 500 events;
- `truncated` informa o cap.

## Job Date Mutation

`PATCH /api/jobs/:id` agora aceita `publicationTarget` e `scheduledAt` como ISO-8601/null. Job service valida e grava as datas; Calendar somente lê.

## Capability Enforcement

`GET /api/calendar` exige `Capability.CALENDAR` depois da cadeia auth/password/workspace. B3 possui CALENDAR nos três templates atuais; nenhum template negativo artificial foi criado.

## Tenant Isolation

Todas as queries usam `req.auth.companyId`. Testes cobrem A/B, Client/Stage foreign, companyId spoof e auth.

## Query Strategy

Company lookup + validações opcionais de Client/Stage + uma query Job com OR temporal, select mínimo e `take=501`. Sem N+1 por dia/client/event.

## Index Review

Índices existentes em companyId/clientId/currentStageId/workflowId/status são reutilizados. Nenhuma migration/index especulativo foi criado.

## Legacy Publication Compatibility

`/api/publications` segue funcionando com os mesmos campos. Não existe `/api/publications/calendar`; o contrato canônico é `/api/calendar`.

## Cross-Tenant Tests

- Tenant A vê apenas seus eventos.
- Tenant B não vê eventos A.
- Client foreign → 404.
- Stage foreign → 404.
- companyId spoof não altera resultado.
- Range boundaries respeitam `[from,to)`.

## Date Boundary Tests

- `at == from` incluído.
- `at == to` excluído.
- `from >= to` rejeitado.
- ISO inválido rejeitado.
- Range maior que 90 dias rejeitado.

## Capability Tests

CALENDAR capability é aplicada. Todos os templates atuais possuem CALENDAR no registry B3; não existe template sem CALENDAR para testar negativamente sem alterar produto. Auth chain permanece obrigatória.

## Security Audit

`.dev-reports/security-audit-b10-2026-08-14.md`:

- Critical: 0.
- High: 0.
- Medium: 0.
- Low: 1 (sem paginação/windowing, com cap 500 e `truncated`).

## Performance Audit

`.dev-reports/performance-audit-b10-2026-08-14.md`:

- Uma query temporal principal.
- Sem N+1.
- Range 90 dias.
- Cap 500 events.
- Projection mínima.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (129/129, 17 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

- Tenant A range → events próprios.
- Tenant B range → sem eventos A.
- Client filter → próprio tenant.
- Date PATCH Job → Calendar projection atualizada.
- companyId spoof → inerte.
- Invalid/reversed/oversized ranges → 400.

## Code Review

1. Nenhum CalendarEvent persistido.
2. Calendar é read-only; PATCH Job é write authority.
3. Datas legacy foram preservadas.
4. Range/result bounded.
5. Client/Stage filters são tenant-safe.
6. Nenhuma UI, integração externa, Dashboard ou recorrência foi criada.

## Changed Files

- `backend/src/services/jobService.ts`
- `backend/src/services/calendarService.ts`
- `backend/src/routes/calendar.ts`
- `backend/src/app.ts`
- `backend/tests/calendar.test.ts`
- `docs/engineering/11-calendar.md`
- `.dev-reports/looply-b10-calendar.md`
- `.dev-reports/security-audit-b10-2026-08-14.md`
- `.dev-reports/performance-audit-b10-2026-08-14.md`

**Schema: unchanged. Frontend: zero changes.**

## Preexisting Dirty Files

Todos os frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Sem `dueAt` genérico.
- Sem paginação/windowing após 500 eventos.
- Sem month/week/day endpoints.
- Sem recorrência.
- Sem Google/Outlook/ICS.
- Dashboard pertence à B11.
- CSRF/rate-limit hardening pertence à B12.

## Risks

- Dois campos temporais legacy exigem projeção OR.
- `Company.timezone` é retornado, mas boundaries locais complexos ficam para UI/futuro.

## Deferred to B11

- Dashboard by Template.
- Tenant-safe aggregate metrics.
- Attention-oriented cards.
- Overdue/upcoming summaries.
- Template-specific dashboard projection.

## Suggested Commit

`feat(v1): add tenant safe calendar projection`

## Next Battery

B11 — Dashboard by Template
