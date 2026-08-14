# Looply V1 — B8 Files

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `f577ff7`
- **B7 ancestry:** confirmada (`f577ff7 feat(v1): add operational job projections`).
- **Dirty worktree preexistente:** `.dev-reports/looply-contents-card-grouping.md`; alterações em 13 arquivos frontend; não rastreados: quatro reports demo, `.env.backup.20260813-132904`, `ecosystem.config.cjs`, `package-lock.json`.
- Nenhum arquivo B8 possuía diff preexistente.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Existing Media / Storage Inventory

- Não existia SDK S3/MinIO, storage client, multer, rota de upload ou filesystem de uploads.
- `JobVersion` possui `mediaUrl`/`mediaType` legados, normalmente URLs externas/metadata.
- Não foram encontrados bytes base64, `writeFile`, `readFile`, bucket, presigned URL ou storageKey.
- Frontend antigo usa media URLs; foi apenas inspecionado e não alterado.

## Architecture Decision

PostgreSQL armazena metadata/autorização. Object storage armazena bytes.

Implementação S3-compatible mínima com AWS SDK v3:

- presigned PUT direto ao storage;
- HEAD no finalize;
- presigned GET no download;
- DELETE server-side;
- nenhuma abstração multi-provider ou plugin framework.

## Storage Provider

Provider: S3-compatible (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).

Env vars:

- `STORAGE_ENDPOINT`
- `STORAGE_REGION`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_FORCE_PATH_STYLE`
- `STORAGE_PRESIGN_TTL_SECONDS`

O provider exige bucket e credenciais explícitas. Sem configuração, retorna `503 storage_unavailable`; não há fallback para disco local.

## Schema Changes

Migration: `20260817100000_job_attachments`.

Novo modelo `JobAttachment`:

- `id`;
- `companyId`;
- `jobId`;
- `uploadedByUserId?`;
- `storageKey` unique;
- `originalName`;
- `contentType`;
- `sizeBytes`;
- `status` (`PENDING`, `AVAILABLE`, `FAILED`);
- `etag?`;
- timestamps.

FKs: Company `RESTRICT`, Job `CASCADE`, User `SET NULL`.

Índices: `(companyId, jobId)`, `(jobId, status)`, unique `storageKey`.

## Migration

Aditiva. Nenhum metadata legado de media foi removido. Migration aplicada com `migrate deploy`, Client gerado e `migrate diff` posterior vazio.

Attachment rows antes/depois: 0/0. Não havia bytes/metadata de upload para migrar.

## Attachment Model

O domínio é `JobAttachment`, não um framework polymorphic genérico. Nesta bateria todo attachment pertence a um Job.

## Tenant Ownership

Todas as operações derivam tenant de `req.auth.companyId` e filtram Company + Job. `companyId`, `uploadedByUserId` e `storageKey` não são aceitos como autoridade do frontend.

## Job Relationship

Upload intent resolve `Job.id + companyId`. Job de outro tenant retorna 404. Attachment também armazena Company explicitamente para filtros e defesa em profundidade.

## Storage Key

Backend gera:

`company/{companyId}/jobs/{jobId}/{uuid}`

Filename original é somente metadata. Não há path traversal, bucket override ou key controlada pelo cliente.

## Upload Contract

`POST /api/jobs/:jobId/files/upload-intent`

Input: `originalName`, `contentType`, `sizeBytes`.

Output: metadata mínima, `uploadUrl`, headers esperados e `expiresAt`.

Bytes não passam pelo Node.

## Upload State

- `PENDING`: intent criada, objeto não verificado.
- `AVAILABLE`: finalize confirmou objeto.
- `FAILED`: reservado para falhas permanentes futuras.

Upload pendente sem finalize não é automaticamente removido em B8.

## Finalize Contract

`POST /api/files/:id/complete`:

1. resolve attachment por `id + companyId`;
2. retorna estado atual se já `AVAILABLE`;
3. executa HEAD server-side;
4. verifica existência, tamanho exato e content type;
5. atualiza para `AVAILABLE` e armazena ETag informativo.

Não confia em flag enviada pelo cliente.

## Download Contract

`GET /api/files/:id/download` exige auth, tenant correto e `AVAILABLE`. Retorna GET presigned curto. Não expõe storageKey, bucket permanente ou credentials.

## List Contract

`GET /api/jobs/:jobId/files` retorna metadata mínima, sem storageKey e sem HEAD por arquivo.

## Delete Semantics

`DELETE /api/files/:id` resolve storageKey pelo DB tenant-scoped, deleta objeto primeiro e depois metadata.

Se object delete falhar, metadata permanece para retry. Falha DB depois de object delete pode deixar orphan object; reconciliação pertence a hardening/operations futura. Não há fila em B8.

## Legacy Media Strategy

`mediaUrl`/`mediaType` em JobVersion foram preservados. Não houve conversão falsa de URLs, cópia de bytes ou remoção de metadata. Novos uploads usam somente JobAttachment/object storage.

## Capability Enforcement

Rotas B8 usam:

`requireAuth → requirePasswordChanged → requireWorkspaceActive → FILES → handler`.

Job ownership é validado no service. Não há checks diretos de template.

## Role Behavior

OWNER, ADMIN e MEMBER podem operar attachments de Jobs nesta V1. Policies mais restritivas ficam para quando Approval definir requisitos.

## Limits

- Upload máximo: 50 MB.
- Filename: control chars removidos, máximo 255 chars.
- Content type: obrigatório, máximo 160 chars.
- Presigned TTL: 60–900 segundos, default 600.

## Presigned URL Security

- bucket privado;
- object key específica;
- método específico;
- TTL curto;
- sem wildcard credentials;
- sem public-read ACL;
- sem credentials em response.

## Cross-Tenant Tests

- Upload intent para Job próprio: sucesso.
- Upload intent para Job estrangeiro: 404.
- `companyId` spoof: inerte.
- Complete/download/delete estrangeiro: 404.
- List Job estrangeiro: 404.
- UploadedBy vem do service/auth, não do input.

## Storage Tests

Fake storage cobre:

- key server-generated;
- PENDING metadata;
- size limit;
- object missing;
- size/type mismatch;
- finalize AVAILABLE;
- finalize idempotente;
- list metadata mínima;
- download apenas AVAILABLE;
- delete object + metadata.

## Security Audit

`.dev-reports/security-audit-b8-2026-08-14.md`:

- Critical: 0
- High: 0
- Medium: 0
- Low: 1 (storage sem config retorna 503 fail-closed).

`npm --prefix backend audit --omit=dev`: 0 vulnerabilities runtime.

## Performance Audit

`.dev-reports/performance-audit-b8-2026-08-14.md`:

- upload direto ao storage;
- list sem HEAD por item;
- download assina apenas um objeto;
- sem N+1 storage calls;
- riscos residuais de orphan objects e list sem paginação.

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (117/117, 15 files) |
| `npm --prefix backend run build` | 0 | PASS |
| `npm --prefix backend run prisma:validate` | 0 | PASS |
| `prisma migrate deploy` | 0 | PASS |
| `prisma generate` | 0 | PASS |
| `prisma migrate diff` pós-migration | 0 | PASS (empty migration) |
| `npm --prefix backend audit --omit=dev` | 0 | PASS (0 runtime vulnerabilities) |
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Smoke Test

Formal waiver: não há endpoint/bucket S3-compatible configurado neste ambiente. Não foi alegado PUT/GET real. Fake storage tests validam o fluxo completo; storage real ausente falha explicitamente em 503.

## Code Review

1. Nenhum byte é salvo no PostgreSQL/base64/filesystem local.
2. Storage key, bucket e uploadedBy são server-owned.
3. Finalize não confia no frontend; executa HEAD e valida tamanho/type.
4. List não executa HEAD por item.
5. Delete usa fileId e resolve key no tenant; não aceita storageKey.
6. Não houve Approval/public file sharing, UI ou provider registry.

## Changed Files

- `.env.example`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260817100000_job_attachments/migration.sql`
- `backend/src/lib/env.ts`
- `backend/src/lib/storage.ts`
- `backend/src/services/attachmentService.ts`
- `backend/src/routes/files.ts`
- `backend/src/app.ts`
- `backend/tests/attachments.test.ts`
- `docs/engineering/09-files-storage.md`
- `.dev-reports/looply-b8-files-storage.md`
- `.dev-reports/security-audit-b8-2026-08-14.md`
- `.dev-reports/performance-audit-b8-2026-08-14.md`

**Frontend: zero changes.**

## Preexisting Dirty Files

Todos os frontend/reports preexistentes permaneceram fora do stage e não foram revertidos.

## Known Gaps

- Provider S3/MinIO não configurado neste ambiente.
- Sem cleanup de PENDING expirado.
- Sem orphan reconciliation.
- Sem multipart uploads.
- Sem antivirus/content scanning.
- Sem files de Client/Company sem Job.
- Sem public Approval file access.

## Risks

- Falha DB após object delete pode deixar orphan object.
- List de attachments não tem paginação explícita; volume esperado por Job é pequeno em V1.

## Deferred to B9

- Approval domain.
- Public approval token hardening.
- Public controlled access to Job files.
- Approval versions.
- Approval decision history.

## Suggested Commit

`feat(v1): add tenant safe file storage`

## Next Battery

B9 — Approval
