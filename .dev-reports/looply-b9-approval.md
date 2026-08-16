# Looply V1 — B9 Approval

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `a9fa0a2`
- **B8 ancestry:** confirmada (`a9fa0a2 feat(v1): add tenant safe file storage`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B9 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Existing Approval Inventory

Antes da B9:

- 38 Approval rows;
- tokens plaintext hex de 64 chars;
- sem tokenHash;
- sem companyId explícito;
- sem expiresAt/revokedAt/decidedAt;
- statuses `PENDING`, `APPROVED`, `CHANGES_REQUESTED`;
- Job/JobVersion links válidos;
- feedback/clientName/clientReviewedAt preservados;
- sem Decision history;
- sem ApprovalAttachment;
- routes públicas usavam `where: { token }` e retornavam dados excessivos.

## Existing Data Analysis

- Approvals antes: 38.
- Status antes: 28 PENDING, 8 CHANGES_REQUESTED, 2 APPROVED.
- JobVersion links válidos.
- Company derivada via Job: `Looply Studio`.
- Attachments antes: 0.
- ApprovalDecision antes: 0.

## Existing Public Paths

- `GET /api/public/approvals/:token`
- `POST /api/public/approvals/:token/approve`
- `POST /api/public/approvals/:token/request-changes`

B9 mantém os paths e adiciona `reject` e file download approval-scoped. O request logger agora redige o token no path.

## Architecture Decision

Adaptar o Approval existente. Token público continua sendo a credencial externa, mas somente seu SHA-256 fica no DB. Approval permanece ligado a uma versão JobVersion específica. Arquivos públicos exigem relação explícita `ApprovalAttachment`; não são todos os anexos do Job automaticamente.

## Schema Changes

- `Approval.companyId` obrigatório.
- `Approval.tokenHash` unique.
- `Approval.expiresAt`, `revokedAt?`, `decidedAt?`.
- Statuses `REJECTED` e `REVOKED`.
- `ApprovalDecision` histórico.
- `ApprovalAttachment` join explícito.
- Activity types de Approval.

## Migration Strategy

Migration `20260818100000_secure_approvals`:

1. habilita `pgcrypto`;
2. adiciona enums/valores;
3. adiciona campos nullable;
4. backfill Company via Job;
5. calcula `tokenHash = SHA-256(token)`;
6. define expiry compatível `createdAt + 30 dias`;
7. aborta se algum row ficar incompleto;
8. aplica NOT NULL/unique/FK;
9. remove plaintext token;
10. cria Decision/ApprovalAttachment.

Não recriou, deletou ou trocou IDs.

## Migration Result

- `prisma migrate deploy`: PASS.
- `prisma generate`: PASS.
- Schema diff posterior: empty migration.
- Approvals preservados: 38.
- Token hash lengths: 64 hex chars.
- Approvals órfãos: 0.
- ApprovalDecision inicial: 0 (não foram fabricadas decisões históricas).
- ApprovalAttachment inicial: 0.

## Approval Model

Approval é tenant-owned e mantém as colunas físicas legacy `contentId`/`contentVersionId`, agora representando Job/JobVersion canônicos. Current status permanece source of truth; Decision é histórico.

## Tenant Ownership

Approval create/list/get/revoke exige `companyId` do auth context. Job e versão são resolvidos dentro do mesmo tenant. `companyId`, jobId, approvalId, actorUserId e storageKey nunca são authorities públicas.

## Version Relationship

Create aceita `versionId` opcional; sem ele usa a versão mais recente. Se o versionId pertence a outro Job, retorna 404. Approval fica fixado à versão selecionada.

## Internal Approval API

- `POST /api/jobs/:jobId/approvals`
- `GET /api/jobs/:jobId/approvals`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/revoke`

Capability: `APPROVAL`. OWNER/ADMIN/MEMBER podem operar nesta V1.

Create retorna token/link uma vez. Token nunca é persistido plaintext.

## Approval Lifecycle

- `PENDING`
- `APPROVED`
- `CHANGES_REQUESTED`
- `REJECTED`
- `REVOKED`

Expiry é derivado de `expiresAt`; não há worker.

## Public Token Model

256-bit random token, SHA-256 no DB, lookup por `tokenHash`. Approval ID não autentica. Tokens públicos são removidos dos request logs por redaction específica do path.

## Token Lifecycle

Token expirado/revogado é 404 genérico. GET continua disponível enquanto válido, inclusive depois da decisão. Decision write conflitante retorna 409; replay da mesma decisão é idempotente.

## Public Read Contract

`GET /api/public/approvals/:token` retorna somente Approval status/expiry, Job title/Client name mínimo, versão, decisões mínimas e attachments explicitamente associados e AVAILABLE.

Não retorna tokenHash, Company interna, storageKey, Activity, memberships, internal notes ou outros Approvals.

## Decision Contract

- `POST /api/public/approvals/:token/approve`
- `POST /api/public/approvals/:token/request-changes`
- `POST /api/public/approvals/:token/reject`

Changes requested exige feedback. Rejected persiste decisão explícita.

## Decision History

`ApprovalDecision` persiste decision, comment, actorName/email/type e createdAt. Histórico anterior ao B9 não é inventado.

## Replay / Concurrency

Update condicional exige PENDING, não revogado, não decidido e não expirado. Uma única decisão vence em concorrência. Replay igual é idempotente; replay conflitante retorna 409.

## Activity Integration

Novos tipos: `APPROVAL_REQUESTED`, `APPROVAL_APPROVED`, `APPROVAL_CHANGES_REQUESTED`, `APPROVAL_REJECTED`, `APPROVAL_REVOKED`.

Create/revoke/decision registram Activity dentro da mesma transaction.

## File Authorization

`GET /api/public/approvals/:token/files/:fileId/download` valida token → Approval → ApprovalAttachment → Job/Company → Attachment AVAILABLE. Não existe file endpoint público genérico.

## Storage Integration

Reutiliza B8 `getObjectStorage()` e presigned GET. Bucket segue privado; storageKey não é exposto. Storage ausente retorna 503 após autorização.

## Capability Enforcement

Rotas internas usam `APPROVAL`. Templates sem capability recebem 403. Public token não usa session capability; o token é a credencial externa.

## Role Behavior

OWNER/ADMIN/MEMBER podem criar/listar/revogar Approval operacional nesta V1. Não foi criado RBAC adicional.

## Legacy Compatibility

`contentService.sendForApproval` chama o mesmo `createApproval`. Os public paths existentes foram mantidos, mas agora usam hash/lifecycle/projection seguro. Não existem dois modelos públicos paralelos.

## Token Logging Review

Request logger transforma `/api/public/approvals/<token>` em `/api/public/approvals/[redacted]`, incluindo decision e file paths.

## Cross-Tenant Tests

- Approval create Job próprio → sucesso.
- Version de outro Job → rejeitada.
- Job inexistente/estrangeiro → 404.
- Internal get/list/revoke usa Company scope.
- ApprovalAttachment exige mesmo Job/Company.
- Public fileId não associado → 404.

## Public Token Tests

- Token válido → read mínimo.
- Token aleatório → 404 genérico.
- Token revogado → 404.
- Token expirado → 404.
- Token plaintext não aparece em logs; path é redigido.

## Decision Tests

- Approved → status/history.
- Rejected → status/history.
- Changes requested exige feedback.
- Replay same decision → idempotente.
- Replay conflicting decision → 409.
- Decision write e Activity são transacionais.

## File Tests

- Attachment explicitamente associado e AVAILABLE → signed GET.
- Attachment não associado → 404.
- Attachment PENDING → não acessível.
- storageKey não aparece em respostas públicas.
- Storage indisponível → 503 fail-closed.

## Security Audit

`.dev-reports/security-audit-b9-2026-08-14.md`:

- Critical: 0
- High: 0
- Medium: 0
- Low: 2 (expiry compatível de 30 dias; rate limit público deferred B12).

## Performance Audit

`.dev-reports/performance-audit-b9-2026-08-14.md`:

- Public projection mínima.
- Sem N+1 de decisions/files.
- Signed GET somente sob demanda.
- Riscos baixos: histórico/list sem paginação.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (124/124, 16 files) |
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

- Internal Agency create Approval → token.
- Public GET without session → 200 minimal.
- Public approve → 200.
- Same approve replay → 200 idempotent.
- Conflicting request changes → 409.
- Internal history → one Decision.
- Reject → REJECTED + history.
- Invalid/revoked tokens → 404.
- Request logs show `[redacted]` instead of token.
- Public file authorization fake storage: associated file only.

Provider real não está configurado; não foi alegado download real de objeto.

## Code Review

1. Approval plaintext tokens foram migrados para SHA-256 e removidos do DB.
2. Public routes foram movidas para antes do auth wall; token é a credencial pública.
3. Request logger redige tokens de Approval.
4. Public response não retorna tokenHash/company/storageKey/internal data.
5. Decision update é condicional e transacional.
6. ApprovalAttachment explícito impede exposição de todos os arquivos do Job.
7. Nenhuma UI, email delivery, Calendar ou Dashboard foi implementado.

## Changed Files

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260818100000_secure_approvals/migration.sql`
- `backend/src/services/approvalService.ts`
- `backend/src/routes/approvals.ts`
- `backend/src/routes/approvalsInternal.ts`
- `backend/src/app.ts`
- `backend/src/middleware/requestLogger.ts`
- `backend/src/services/contentService.ts`
- `backend/src/seed.ts`
- `backend/tests/approval.test.ts`
- `docs/engineering/10-approval.md`
- `.dev-reports/looply-b9-approval.md`
- `.dev-reports/security-audit-b9-2026-08-14.md`
- `.dev-reports/performance-audit-b9-2026-08-14.md`

**Frontend: zero changes.**

## Preexisting Dirty Files

Todos os frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Email delivery não implementado.
- Rate limit específico de Approval público deferred B12.
- Histórico pré-B9 não possui Decision rows fabricados.
- Storage real não configurado no ambiente.
- Approval não altera automaticamente Workflow Stage.

## Risks

- Tokens existentes receberam expiry compatível de 30 dias.
- Token em URL ainda pode aparecer em browser/upstream logs; app logger redige.
- Delete/object reconciliation de B8 permanece pendente.

## Deferred to B10

- Calendar.
- Due/scheduled operational projection.
- Date-based Job views.
- Publication/calendar legacy consolidation.

## Suggested Commit

`feat(v1): add secure public approvals`

## Next Battery

B10 — Calendar
