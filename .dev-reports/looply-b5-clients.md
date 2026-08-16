# Looply V1 — B5 Clients

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `7370f2a43c75ca0893860944a74fb7a13326353b`
- **B4 principal:** `a67e95e`
- **B4 remediation:** `7370f2a` — `fix(auth): close legacy user creation path`
- **Ancestry confirmada:** `a67e95e` e `7370f2a` estão no ancestry de HEAD.
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend (`components`, `features`, `index.css`, `tailwind.config.js`); não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B5 possuía diff antes da implementação.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Current Client State

Antes da B5, Client era global:

- sem `companyId`;
- `name` globalmente unique;
- `clientService` fazia `findUnique({ id })` sem tenant;
- rotas não passavam `req.auth.companyId`;
- apenas list/detail/create existiam;
- não havia PATCH/DELETE;
- Content validava `clientId` globalmente.

## Client Caller Inventory

| Caller | Estado B5 |
|---|---|
| `backend/src/routes/clients.ts` | Adaptado para tenant-scoped CRUD + capability |
| `backend/src/services/clientService.ts` | Adaptado; centraliza filtros por company |
| `backend/src/services/contentService.ts` | Criação de Content agora valida Client por `id + companyId` |
| `backend/src/services/dashboardService.ts` | `client.count()` global mantido; Dashboard é B11 |
| `backend/src/seed.ts` | Adaptado para unique composto |
| frontend `useClients` / Clients feature | Read-only inspection; nenhuma alteração |

## Architecture Decision

Adaptar o model/service existente, sem Repository, BaseTenantService ou abstração genérica. `companyId` obrigatório e imutável. Cross-tenant por ID responde 404.

## Schema Changes

- `Client.companyId String NOT NULL`.
- Relation `Client.company → Company` com `ON DELETE RESTRICT`.
- `Company.clients` relation.
- `@@index([companyId])`.
- `@@unique([companyId, name])` no lugar da unique global.

## Existing Data Analysis

- Companies no DB antes da migration: 5.
- Clients antes da migration: 6.
- Os 6 Clients eram dados da fase single-tenant Demo V1.
- A única Company demo correspondente é `Looply Studio` (`slug=looply-studio`).
- As Companies de teste/provisionamento B4 não possuíam Clients existentes.
- Nenhum Client foi deletado.

## Migration / Backfill Strategy

Migration `20260815100000_clients_tenant_scoped`:

1. Add nullable `companyId`.
2. Backfill via subquery determinística `Company.slug = 'looply-studio'`.
3. Abort if any Client remains null.
4. Set `companyId NOT NULL`.
5. Drop unique global de name.
6. Add FK, index e unique composto.

Não houve reset, truncate, delete, DROP de dados ou associação por “primeira Company”.

## Migration Result

- Aplicada via `prisma migrate deploy`.
- Prisma Client regenerado.
- Antes: 6 Clients.
- Depois: 6 Clients.
- Órfãos: 0.
- Distribuição: 6 em `Looply Studio`.
- `prisma validate`: PASS.

## Client Model After B5

Client é tenant-owned, com status legado preservado (`ACTIVE`, `INACTIVE`, `PROSPECT`) e campos genéricos úteis da Demo. Nenhum CRM ou redesign foi antecipado.

## Tenant Trust Model

Toda rota usa `req.auth!.companyId`. Body/query não pode escolher tenant. Create injeta ownership no service; update não aceita `companyId`; detail/update/delete filtram `id + companyId`.

## CRUD

- List: `GET /api/clients`
- Detail: `GET /api/clients/:id`
- Create: `POST /api/clients`
- Update: `PATCH /api/clients/:id`
- Delete: `DELETE /api/clients/:id`
- Busca e status filter continuam mínimos e tenant-scoped.
- Delete retorna 409 quando há Content vinculado; sem cascade destrutivo.

## Capability Enforcement

`requireCapability(Capability.CLIENTS)` aplicado no router de Clients. A cadeia anterior continua global: auth, senha trocada e workspace ativo.

## Search / Filter

`search` por nome e `status` são filtrados junto com `companyId`. Testes confirmam que busca de Tenant A não retorna nome de Tenant B.

## Delete Semantics

Client com Content vinculado não é apagado; API retorna 409. Client sem dependências pode ser removido. Tentativa cross-tenant retorna 404.

## Relation with Content

Content continua legado e será generalizado em B6. O create Content foi endurecido para não aceitar `clientId` de outro tenant. Leitura/listagem global de Content e Dashboard continuam gaps explícitos, não são declarados como resolvidos nesta bateria.

## Cross-Tenant Tests

- A lista apenas seus Clients; B lista apenas os seus.
- A lê A1; A lê B1 → 404.
- B lê A1 → 404.
- A não atualiza/deleta B1.
- A cria com `companyId=B` no body e o registro permanece em A.
- Search/status não atravessam tenant.
- Sem sessão → 401.
- Capability CLIENTS e workspace gates são preservados pela cadeia de middleware.

## Security Audit

`.dev-reports/security-audit-b5-2026-08-14.md`:

- Critical: 0
- High: 0
- Medium: 0
- Low: 2 (Dashboard global e Content legado, ambos deferred)

Nenhum finding B5 bloqueante.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (102/102, 12 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` | 0 | PASS |
| `prisma generate` | 0 | PASS |
| `npm --prefix backend run seed` | 0 | PASS |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

No PM2 dev runtime:

- Tenant A login → 6 Clients.
- Tenant B login → 0 Clients.
- A resource ID accessed by B → 404.
- B create with spoofed `companyId` → owner remains B.
- Unauthenticated list → 401.
- Temporary smoke Client removed with tenant-scoped DELETE → 204.

## Code Review

1. Initial mutation implementation performed a scoped lookup followed by `update/delete` by global ID; corrected to `updateMany/deleteMany` with `{ id, companyId }` directly.
2. Content creation lookup was global; corrected to validate `{ clientId, companyId }` from auth context.
3. No frontend changes, no new dependency, no destructive migration, no arbitrary fallback Company.
4. Remaining global Client callers are explicitly Dashboard B11 and Content read paths B6; neither is claimed as fully isolated by B5.

## Changed Files

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260815100000_clients_tenant_scoped/migration.sql`
- `backend/src/services/clientService.ts`
- `backend/src/routes/clients.ts`
- `backend/src/routes/contents.ts`
- `backend/src/services/contentService.ts`
- `backend/src/seed.ts`
- `backend/tests/clientsTenant.test.ts`
- `backend/tests/clientsTenantHttp.test.ts`
- `backend/tests/contentService.test.ts`
- `docs/engineering/06-clients.md`
- `.dev-reports/looply-b5-clients.md`
- `.dev-reports/security-audit-b5-2026-08-14.md`

**Frontend: zero changes.**

## Preexisting Dirty Files

Todos os arquivos frontend e reports preexistentes permaneceram fora do stage. Nenhuma alteração foi revertida ou sobrescrita.

## Known Gaps

- Content/Job ainda não possui ownership completa por Company.
- Dashboard ainda conta Clients globalmente.
- Client detail inclui Content legado; isolamento completo dessa relação é B6.
- CSRF/rate-limit hardening pertence à B12.

## Risks

- O backfill depende da evidência histórica de que os seis Clients eram single-tenant Demo V1; isso foi verificado contra o estado e seed atuais.
- Companhias provisionadas sem Clients permanecem vazias, como esperado.

## Deferred to B6

- Job domain.
- Content → Job generalização.
- Workflow.
- Activity.
- Job-level tenant isolation.
- Template workflow defaults.
- Frontend Figma integration.

## Suggested Commit

`feat(v1): make clients tenant scoped`

## Next Battery

B6 — Jobs + Workflow + Activity
