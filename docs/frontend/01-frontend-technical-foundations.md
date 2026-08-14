# Looply V1 — Frontend Technical Foundations (F2A)

Estado real após F2A. **Foundation técnica pronta: API client normalizado, contrato de erros consistente, cancellation, retry policy, modelo de session/workspace/capabilities tipado a partir do contrato real do backend, helper de capability UX, helper puro de first-login routing e test harness. Nenhum design visual foi implementado (F2B) e nenhuma tela F3+ foi criada.**

## API Client

`apiFetch<T>(path, { method?, body?, signal?, headers? })` em `src/lib/api.ts`:

- `fetch` nativo; sem axios, sem SDK, sem nova dependência;
- exporta `ApiFetchOptions`;
- todos os callers de domínio passam pelo client (fetches diretos em `ContentsList.tsx` migrados).

## Credentials / Session

- `credentials: "include"` em toda request (cookie session do backend).
- Sem Bearer token, sem JWT, sem localStorage/sessionStorage auth.

## Request Body

- `Content-Type: application/json` **somente** quando `body !== undefined`;
- body é objeto; o client faz `JSON.stringify` (callers não stringificam mais);
- sem FormData — uploads futuros usam presigned PUT direto ao storage (B8), não multipart pelo Node.

## Error Contract

`ApiError extends Error { status, code?, retryAfterSeconds? }` — sem subclasses por status.

Backend B12 mapeado 1:1: 400/401/403/404/409/413/429/503 preservados com `status`, `code` e `message` do backend.

Parsing normalizado:

- 204/no content → `null`;
- JSON success → objeto;
- JSON error → `ApiError` com code/message;
- non-JSON error → `ApiError` com mensagem genérica `Erro <status>` (nunca vaza corpo bruto).

## Retry Policy

`shouldRetry(failureCount, error)` exportado de `api.ts`:

- nunca retenta: 400, 401, 403, 404, 409, 413, 429;
- permite 1 tentativa: 500/502/503/504 e erros de rede;
- máx 1 retry (`failureCount >= 1` → false);
- `QueryClient` (main.tsx): queries usam `shouldRetry`; **mutations nunca retentam** (escritas não são idempotentes: approvals, transitions, uploads).

## Cancellation

- `apiFetch` aceita `signal?: AbortSignal` e repassa ao `fetch`;
- hooks existentes não foram todos migrados (evitar scope creep); hooks canônicos futuros (F4+) devem passar `{ signal }` do queryFn.

## 401 Policy

`ApiError` 401 é propagado ao caller. **Nenhum redirect automático dentro do apiFetch** — o boundary de auth (ProtectedRoute/F3) decide UX. Evita side effects em rotas de auth.

## 403 Policy

403 preserva `code`/`message` do backend (pode ser capability, onboarding pendente, password change, origin estrangeira). F3 usa os códigos para UX; nenhum mapeamento automático para "sem permissão".

## 429 / 503

- 429: `Retry-After` (segundos) parseado para `retryAfterSeconds`; sem retry automático;
- 503: preservado como dependency unavailable; sem retry de mutations.

## Session Model

Tipos derivados do **contrato real** de `GET /api/auth/me` (backend/src/routes/auth.ts), não de docs:

```ts
interface SessionInfo {
  user: { id; name; email };
  activeCompanyId: string;
  mustChangePassword: boolean;
  memberships: { companyId; companyName; role }[];
  workspace: WorkspaceContext | null;
}
```

## Workspace Model

```ts
interface WorkspaceContext {
  id; name;
  template: WorkspaceTemplate | null;
  capabilities: Capability[];
  status: "ACTIVE" | "UNCONFIGURED";
}
```

## Capability Model

`type Capability` — union literal dos 9 identificadores do registry backend (CLIENTS, JOBS, WORKFLOW, KANBAN, FILES, APPROVAL, CALENDAR, ACTIVITY, DASHBOARD). **Nenhuma matriz template→capability no frontend** — o frontend apenas modela o que recebe.

## Capability UX Rule

`src/lib/workspace.ts`:

- `hasCapability(session, cap)` — resposta a "a UI deve mostrar isto?";
- `isWorkspaceActive(session)`;
- **nunca** autoridade: autorização continua 100% backend.

## Tenant Authority Rule

Nenhum `companyId` é enviado como autoridade em qualquer caller. `activeCompanyId`/`memberships[].companyId` são dados de resposta para display. Sem tenant em storage.

## First-login Foundation

`getPostLoginDestination(session)` — helper **puro** e testado:

- `mustChangePassword` → `/change-password`;
- workspace ausente/`UNCONFIGURED` → `/onboarding`;
- senão → `/dashboard`.

As rotas `/change-password` e `/onboarding` ainda **não existem** — a integração real de redirect pertence a F3. Nenhuma tela placeholder foi criada.

## Query Client

`main.tsx`: `staleTime 15s`, `retry: shouldRetry`, `refetchOnWindowFocus: false`, `mutations.retry: false`. Query keys existentes (`me`, `dashboard`, `clients`, ...) já são simples e estáveis — mantidos sem refactor estético.

## Direct Fetch Policy

Zero `fetch(` direto fora do client em `src/` (os 2 em `ContentsList.tsx` foram migrados para `apiFetch`, preservando comportamento: mesmos endpoints/métodos, agora com credentials/ApiError). Regra para F4+: nenhum caller de domínio pode chamar `fetch` diretamente.

## CSRF Compatibility

Backend B12 valida Origin/Referer em mutations com cookie. O `fetch` do browser envia Origin automaticamente; o client **não** forja headers Origin. Nenhum token CSRF client-side — o guard de origem é do backend.

## React Router Decision

- Antes: `react-router-dom@6.30.4` com advisories moderados de runtime (open redirect/XSS; affected range 6.0.0–7.17.0).
- `npm audit fix` (sem `--force`) não alterava nada — fix exige major.
- Superfície de routing atual (BrowserRouter/Routes/Route/Navigate/Outlet/useParams/useNavigate/useLocation/Link) é compatível com o modo declarativo da v7.
- **Decisão: upgrade para `react-router-dom@7.18.2`.** Prova: typecheck PASS, 32/32 testes PASS, build PASS. Advisory runtime eliminado; restam apenas advisories dev-tooling (vite/vitest/esbuild), idênticos aos do backend.
- Custo observado: bundle +15KB gzip (~103.6KB). Aceitável; reavaliar em F10 se necessário.

## Dependency Security

Runtime: 0 advisories após o upgrade do React Router. Restantes (5) são dev-tooling (vite/vitest/esbuild chain) — sem `--force`; upgrade major de tooling fica para fase de manutenção.

## Tests

- `src/test/utils.tsx`: `createTestQueryClient()` (retries off) + wrapper provider;
- `src/tests/apiClient.test.ts` — 20 casos: credentials include, JSON success, 204, JSON error→ApiError, non-JSON error seguro, Retry-After 429, signal passthrough, 401/403/503 preservados, content-type condicional, shouldRetry (400/401/403/404/409/429→false; 500/rede→1 retry; nunca além do 1º);
- `src/tests/workspace.test.ts` — 7 casos: hasCapability (presente/ausente/missing workspace), isWorkspaceActive, getPostLoginDestination (3 caminhos);
- `src/tests/format.test.tsx` — 5 testes originais mantidos verdes.
- Total: 32/32.

## Security Notes

- Sem token auth local; sem secrets em `VITE_*` (apenas `VITE_API_URL`, público por natureza);
- corpo de erro não-JSON nunca vaza para a UI;
- nenhum logging de token de Approval/cookie/signed URL (client não loga URLs);
- ver `.dev-reports/security-audit-f2a-2026-08-14.md`.

## Performance Notes

- Retry único apenas em erros transitórios; mutations sem retry — reduz chamadas duplicadas sensíveis;
- bundle +15KB gzip pelo RR7 — monitorar em F10;
- sem nova dependência runtime além do upgrade do router existente;
- ver `.dev-reports/performance-audit-f2a-2026-08-14.md`.

## F2B Boundary

Pertence a F2B (quando o Figma aprovar): design tokens, visual primitives, App Shell, Sidebar/Header, navegação responsiva, foundations visuais.

## F3 Boundary

Pertence a F3: telas de change-password/onboarding, integração real do `getPostLoginDestination` nos redirects, UX de 401/403 por código, workspace switch UI.
