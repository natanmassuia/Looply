# Looply Frontend — F2A Technical Foundations

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `ab5840f`
- **F1 ancestry:** confirmada (`ab5840f docs(frontend): map integration baseline`; B12 `cd0f15e` no ancestry).

## F1 Ancestry

`git log` confirma `ab5840f` no HEAD com toda a cadeia B0–B12 + F1.

## Dirty Worktree

**Preexisting dirty (preservados, fora do stage):** 14 tracked (13 frontend visuais + 1 report) + 8 untracked (4 reports demo, `.env.backup`, `ecosystem.config.cjs`, `package-lock.json` root, docs/frontend já commitado em F1).

**F2A files (sem overlap):** `api.ts`, `types.ts`, `main.tsx`, `features/ContentsList.tsx` (não estava dirty), `lib/workspace.ts` (novo), `test/utils.tsx` (novo), `tests/apiClient.test.ts` (novo), `tests/workspace.test.ts` (novo), `package.json`/`package-lock.json` frontend.

**Overlap:** nenhum — zero arquivos F2A tinham diff preexistente.

## Existing API Client

F1 já mapeou: `credentials: "include"` correto; sem signal; sem Retry-After; JSON.parse sem normalização; `Content-Type` sempre enviado; 2 fetches diretos em ContentsList; `SessionInfo` sem `mustChangePassword`/workspace.

## API Client Changes

- `apiFetch(path, { method?, body?, signal?, headers? })` — body é objeto (client stringifica); JSON content-type só com body; exportado para uso de domínio;
- parsing: 204→null, JSON success, JSON error→ApiError, non-JSON error→ApiError seguro (mensagem genérica);
- callers internos deixaram de passar `JSON.stringify` (ajustados no mesmo arquivo).

## Error Contract

`ApiError { status, code?, retryAfterSeconds? }`. 400/401/403/404/409/413/429/503 preservados com code/message do backend. Sem subclasses. Sem redirect automático de 401 no client.

## Retry Policy

`shouldRetry`: 4xx nunca; 500+/rede 1x; máximo 1. `main.tsx`: queries `retry: shouldRetry`; mutations `retry: false`.

## Cancellation

`signal` aceito e repassado ao fetch. Hooks existentes não migrados (scope); hooks canônicos F4+ devem usar.

## Direct Fetch Inventory

`grep fetch(` em `src/` antes: 3 (1 no apiFetch, 2 em ContentsList). Depois: 1 (somente o do apiFetch). **Zero fetch direto de domínio.** Migração preservou endpoints/métodos; ContentsList.tsx não tinha diff preexistente.

## Direct Fetch Changes

`handleDropOnColumn` agora usa `apiFetch` (POST workflow / PATCH status com body objeto). Comportamento igual; erros continuam engolidos pelo catch local (sem change de UX).

## Session Contract

Modelado do backend real (`routes/auth.ts`): `mustChangePassword: boolean` + `workspace: WorkspaceContext | null` adicionados a `SessionInfo`.

## Workspace Contract

`WorkspaceContext { id, name, template|null, capabilities, status: ACTIVE|UNCONFIGURED }` — espelha `resolveWorkspaceContext` do backend.

## Capabilities

`type Capability` — 9 literals do registry. Sem matriz frontend. `hasCapability(session, cap)` + `isWorkspaceActive(session)` em `lib/workspace.ts`.

## Tenant Authority

Nenhum `companyId` como autoridade; nada em storage. `activeCompanyId` é display-only.

## Auth Foundation

ApiError 401 propagado; policy 403 preserva código (F3 decide UX). Sem telas.

## First-login Foundation

`getPostLoginDestination(session)` puro + testado: mustChangePassword→`/change-password`; workspace null/UNCONFIGURED→`/onboarding`; senão `/dashboard`. Rotas ainda não existem (F3); helper não integrado ao shell.

## Query Client Foundation

`shouldRetry` nas queries; mutations sem retry; staleTime/refetchOnWindowFocus mantidos. Query keys mantidos.

## Test Harness

`src/test/utils.tsx`: `createTestQueryClient()` (retry off, gcTime 0) + wrapper provider. Sem MSW — mocks de fetch diretos nos testes do client.

## React Router Advisory

6.30.4; advisories moderados runtime (open redirect XSS); `npm audit fix` sem force não mudava nada (fix = major). Superfície usada (BrowserRouter/Routes/Route/Navigate/Outlet/useParams/useNavigate/useLocation/Link) compatível com modo declarativo v7.

## Router Upgrade Decision

**Upgraded para `react-router-dom@7.18.2`.** Prova: typecheck PASS, 32/32 testes PASS, build PASS. Advisory runtime eliminado; restam 5 advisories dev-tooling (vite/vitest/esbuild — iguais ao backend, sem `--force`). Bundle +15KB gzip — aceitável, revisitar F10.

## Dependency Audit

Runtime: 0 vulnerabilities pós-upgrade. Dev: 5 (tooling chain). `npm audit fix --force` não executado.

## Security Audit

`.dev-reports/security-audit-f2a-2026-08-14.md` — 0 critical/high/medium; 1 low (dev advisories); 3 info.

## Performance Audit

`.dev-reports/performance-audit-f2a-2026-08-14.md` — retry fail-fast; sem replay de mutations; +15KB gzip; signal pendente em hooks legacy (documentado).

## Frontend Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (32/32, 3 files) |
| `npm --prefix frontend run build` | 0 | PASS |
| `npm --prefix frontend audit` | 1 | 5 dev-only (runtime 0) |

## Backend Regression

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (141/141) |
| `npm --prefix backend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Code Review

1. Nenhuma mudança visual/backend; nenhum arquivo dirty capturado.
2. Sem JWT/localStorage/companyId authority/matriz capability frontend.
3. Sem redirect 401 automático; sem retry de 4xx/mutations.
4. Upgrade RR v7 provado por gates verdes; sem `--force`.
5. Fetches diretos eliminados sem tocar lógica dirty.

## Changed Files

- `frontend/src/lib/api.ts` (apiFetch/ApiError/shouldRetry/SessionInfo)
- `frontend/src/lib/types.ts` (Capability/WorkspaceContext)
- `frontend/src/lib/workspace.ts` (novo)
- `frontend/src/main.tsx` (retry policy)
- `frontend/src/features/ContentsList.tsx` (fetches → apiFetch)
- `frontend/src/test/utils.tsx` (novo)
- `frontend/src/tests/apiClient.test.ts` (novo)
- `frontend/src/tests/workspace.test.ts` (novo)
- `frontend/package.json` + `frontend/package-lock.json` (RR 7.18.2)
- `docs/frontend/01-frontend-technical-foundations.md` (novo)
- `.dev-reports/looply-f2a-frontend-foundations.md`, `security-audit-f2a-*`, `performance-audit-f2a-*` (novos)

## Preserved Preexisting Dirty Files

Todos os 14 tracked + untracked mantidos fora do stage.

## Known Gaps

- Hooks legacy sem signal;
- `getPostLoginDestination` não integrado (rotas inexistentes);
- bundle +15KB gzip;
- dev advisories tooling pendentes.

## Deferred to F2B

- Figma foundations; visual tokens; shared visual components; App Shell; Sidebar/Header; navegação responsiva.

## Deferred to F3

- change-password UI; onboarding UI; redirects finais de auth; UX 401/403 por código; workspace switch.

## Suggested Commit

`chore(frontend): establish technical foundations`

## Next Step

F2B — Design Foundations + Components + App Shell (após aprovação do Figma)
