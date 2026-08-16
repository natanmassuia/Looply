# Looply Frontend — F1 Baseline

## Baseline

- **Branch:** `feature/demo-v1-polish`
- **SHA inicial real:** `cd0f15e`
- **B12 ancestry:** confirmada (`cd0f15e chore(v1): harden module boundaries and readiness`).

## B12 Ancestry

`git log` confirma `cd0f15e` no HEAD com toda a cadeia B1–B12.

## Skills / MCPs

- `caveman`
- `kore-validate`
- `security-audit`
- `performance-audit`
- `kore-report`
- `code-review` não existe como skill disponível; revisão manual independente executada.

## Dirty Worktree

**Tracked modificados (preexistentes, preservados):**

- `.dev-reports/looply-contents-card-grouping.md`;
- `frontend/src/components/{AppLayout,Icons,Sidebar,StatusPill,common}.tsx`;
- `frontend/src/features/{Calendar,Clients,ContentDetail,Dashboard,NewContent,PublicApproval,Team}.tsx`;
- `frontend/src/index.css`;
- `frontend/tailwind.config.js`.

**Untracked (preexistentes, preservados):**

- quatro reports demo em `.dev-reports/`;
- `.env.backup.20260813-132904`;
- `ecosystem.config.cjs`;
- `package-lock.json` (root).

F1 não editou nenhum desses arquivos. Os dirty frontend correspondem ao visual redesign Demo V1 feito antes das baterias backend.

## Frontend Tree

```
src/
├── main.tsx                 # StrictMode + QueryClient + BrowserRouter
├── App.tsx                  # rotas
├── index.css                # estilos globais Demo V1
├── components/
│   ├── AppLayout.tsx        # shell (Sidebar + Outlet + logout header)
│   ├── Sidebar.tsx          # navegação estática (5 itens)
│   ├── Breadcrumb.tsx       # navegação breadcrumb
│   ├── Icons.tsx            # ícones
│   ├── StatusPill.tsx       # pill de status
│   └── common.tsx           # primitivos (Card, Button, etc.)
├── features/
│   ├── Login.tsx            # login + ProtectedRoute (UX guard)
│   ├── Dashboard.tsx        # dashboard legacy
│   ├── ContentsList.tsx     # board legacy com drag/group
│   ├── NewContent.tsx       # criação social-content
│   ├── ContentDetail.tsx    # detail, versões, workflow, approval link
│   ├── Calendar.tsx         # grid mensal sobre publications
│   ├── Clients.tsx          # lista/criação clients
│   ├── Team.tsx             # lista/criação team (POST 410)
│   └── PublicApproval.tsx   # aprovação pública por token
├── lib/
│   ├── api.ts               # apiFetch + hooks Query (auth/domínios)
│   ├── types.ts             # tipos mirror (Content-centric)
│   ├── store.ts             # Zustand (apenas sidebar UI)
│   └── format.ts            # formatação
├── test/setup.ts
└── tests/format.test.tsx    # 5 testes (só format)
```

## Route Inventory

| Route | Component | Auth | APIs | Classificação | Fase |
|---|---|---:|---|---|---|
| `/login` | Login.tsx | no | auth/login, auth/me | canonical (incompleta) | F3 |
| `/dashboard` | Dashboard.tsx | UX | dashboard, team | mista legacy/canonical | F4 |
| `/contents` | ContentsList.tsx | UX | contents, clients | legacy bridge | F6 |
| `/contents/new` | NewContent.tsx | UX | clients, team, contents | legacy social | F6 |
| `/contents/:id` | ContentDetail.tsx | UX | contents/:id/* | legacy bridge | F6/F7 |
| `/calendar` | Calendar.tsx | UX | publications | legacy bridge | F8 |
| `/clients` | Clients.tsx | UX | clients | canonical (B5) | F5 |
| `/team` | Team.tsx | UX | team GET+POST | GET legacy; POST 410 | F9 |
| `/approve/:token` | PublicApproval.tsx | token público | public/approvals | canonical path, drift | F7 |
| `/` e `*` | Navigate | no | — | redirect /dashboard | F2/F4 |

## Page Inventory

- **Dashboard**: consome `counts` legacy + `recentContents` + `needingAttention` + `team`.
- **ContentsList**: board por status com client filter, drag entre colunas (fetch direto `/api/contents/:id/status` fora do apiFetch), grouping long-hover.
- **NewContent**: form social (format/channel/caption/mediaUrl) + team responsible.
- **ContentDetail**: versões, ações workflow (review/send-approval/schedule/publish), approval link com `token` plaintext, mediaUrl preview.
- **Calendar**: grid mensal local sobre `publications` (scheduledAt ?? publicationTarget).
- **Clients**: lista + create.
- **Team**: lista + create (POST já 410).
- **PublicApproval**: read + approve + request-changes públicos.
- **Login**: email/senha; redirect pós-login via `window.location.assign`.

## Component Inventory

**Generic reusable:** `common.tsx`, `StatusPill`, `Breadcrumb`, Icons, AppLayout/Sidebar (shell).

**Domain/legacy:** cards/grouping em ContentsList; version editor em ContentDetail; social fields em NewContent; publication calendar; public approval UI; team create UI (deprecated).

## API Caller Inventory

| Caller | Endpoint | Classificação |
|---|---|---|
| useLogin | POST /api/auth/login | CANONICAL |
| useMe | GET /api/auth/me | CANONICAL (modelo incompleto) |
| useLogout | POST /api/auth/logout | CANONICAL |
| useDashboard | GET /api/dashboard | CANONICAL path / LEGACY fields |
| useClients/useCreateClient | /api/clients | CANONICAL |
| useTeam | GET /api/team | LEGACY bridge |
| useCreateTeamMember | POST /api/team | DEPRECATED (410) |
| useContents/useContent/useCreateContent | /api/contents* | LEGACY bridge |
| useWorkflowAction (4 paths) | /api/contents/:id/* | LEGACY bridge |
| useCreateVersion | /api/contents/:id/versions | LEGACY bridge |
| useGroupContent/useUngroupContent | /api/contents/:id/{,un}group | LEGACY bridge |
| ContentsList fetch direto ×2 | /api/contents/:id{,/status} | LEGACY (bypass apiFetch: sem credentials explícitos/ApiError) |
| usePublications | GET /api/publications | LEGACY bridge |
| useApproval | GET /api/public/approvals/:token | CANONICAL public (drift) |
| useApprovePublic/useRequestChangesPublic | POST /api/public/approvals/:token/* | CANONICAL public |

**Nenhum caller usa** `/api/jobs`, `/api/calendar`, `/api/files`, Approval interno, members/invitations, onboarding.

## Legacy Bridge Callers

- `/api/contents`: ContentsList, NewContent, ContentDetail, lib/api.ts (7 hooks/mutations + 2 fetch diretos).
- `/api/publications`: Calendar.
- `/api/team`: Dashboard, NewContent, Team.
- Legacy dashboard fields: Dashboard (`counts`, `recentContents`, `needingAttention`).
- `mediaUrl`/`mediaType`: types, NewContent, ContentDetail, PublicApproval.

## Canonical Contract Map

| Área | Contrato backend | Frontend hoje | Alvo |
|---|---|---|---|
| Auth | login/logout/me/change-password | 3 de 4; change-password ausente | F3 |
| Workspace | /api/onboarding/*, me.workspace | não consumido | F3 |
| Clients | /api/clients | em uso | F5 |
| Jobs | /api/jobs, board, summary, transition, activity | não usado | F6 |
| Files | /api/jobs/:jobId/files, /api/files/* | não usado | F7 |
| Approval interno | /api/jobs/:jobId/approvals, /api/approvals/* | não usado | F7 |
| Approval público | /api/public/approvals/* | parcial (drift de tipos) | F7 |
| Calendar | /api/calendar | não usado (usa publications) | F8 |
| Dashboard | /api/dashboard capability-aware | path usado, fields legacy | F4 |
| Members/invitations | rotas B4 | não usado | F9 |

## Contract Drift

| Área | Drift | Ação |
|---|---|---|
| SessionInfo | backend expõe `mustChangePassword`, workspace/template/capabilities; frontend não modela | F3 |
| Dashboard type | backend tem summary/attention/recent/capabilities; frontend só legacy counts | F4 |
| Approval interno | backend não retorna token plaintext; tipo `Approval.token` quebrado | F7 |
| ApprovalStatus | backend tem REJECTED/REVOKED; tipo sem eles | F7 |
| Jobs | sem tipos/hooks canônicos | F6 |
| Calendar | backend range API; frontend espera publications | F8 |
| Team POST | 410; UI ainda chama | F9 |
| Files | sem contrato frontend | F7 |

## Auth Flow

Login → cookie session → ProtectedRoute via useMe (redirect /login em erro). **Gaps**: sem rota de change-password; sem onboarding; sem tratamento de mustChangePassword; sem consumo de workspace/capabilities. Backend bloqueia operações (B4/B12), então guard frontend é apenas UX incompleto.

## Capability Flow

Nenhum consumo. Sidebar estática (5 itens fixos). Sem checks de template/role hardcoded. `/api/auth/me` já retorna capabilities; F3+ deve consumir para visibilidade (nunca autoridade).

## Tenant/company State Findings

- Nenhum `companyId` enviado como autoridade em payloads/queries.
- `SessionMembership.companyId` é apenas dado de resposta.
- Sem tenant em localStorage/sessionStorage.

## State Management

- **TanStack Query** (server state): keys `me`, `dashboard`, `clients`, `team`, `contents`, `content`, `publications`, `approval`; invalidação ampla legacy.
- **Zustand**: apenas `sidebarCollapsed`/`toggleSidebar`. Sem duplicação de dados de servidor.
- **Local state**: forms, modais, cursor calendário, drag state.

## API Client Review

`apiFetch`: relative URL + `VITE_API_URL` override, `credentials: "include"`, JSON, `ApiError(status, message, code)`. **Gaps**: sem política central 401/403/409/429/503; sem cancelamento; parse error não normalizado; 2 fetch diretos em ContentsList bypassam o client (sem ApiError/credentials explícitos — funciona no proxy same-origin, mas inconsistente). Correção do client é F2; nenhum change aplicado em F1.

## Error Handling

- Páginas mostram `error.message` genérico.
- 401 tratado apenas pelo ProtectedRoute (redirect login).
- Sem tratamento específico para 403 (capability), 409 (replay/conflito), 429 (rate limit), 503 (storage). Mapeado para F2 foundation.

## Visual System

Tailwind config + index.css (dirty preexistente = redesign Demo V1). Tokens: cores looply-*, radius, sombras. F1 sem mudanças visuais. F2 substituirá pelo design system Figma.

## Dependency Audit

`npm --prefix frontend audit`: 5 moderate, 1 high, 1 critical (total 7). Runtime: react-router moderate (2 advisories, fix exige major 7). Restante dev-tooling (vite/vitest/esbuild). **Nenhum fix aplicado em F1** (zero frontend change; upgrade é decisão de compatibilidade F2/F10).

## React Router Advisory

`react-router-dom@6.30.4`; advisories moderate (open redirect XSS, CVE-2025-68470 bypass); sem patch minor na major 6 (`fixAvailable` aponta major). **Recomendação documentada**: avaliar upgrade para v7 em F2/F10 com teste de compatibilidade de `BrowserRouter`/`Routes` (API compatível na migração data router). Nenhum upgrade executado.

## Test Inventory

- Vitest + Testing Library/JSDOM.
- 5 testes: apenas `format.ts`.
- Sem: testes de rotas, api client, guards, QueryClient helpers, API mocks/MSW.
- F1 adicionou testes? **Não** — api client já tem `credentials: "include"` e ProtectedRoute existe; coverage de telas legacy foi deliberadamente evitada. Foundation tests ficam para F2.

## Security Audit

`.dev-reports/security-audit-f1-2026-08-14.md` — 2 medium (Approval token drift; ausência de guard first-login), 1 medium (React Router advisory), 1 low (capabilities não consumidas). Sem tokens locais, sem secrets em VITE_*, sem innerHTML, cookie credentials corretos.

## Performance Audit

`.dev-reports/performance-audit-f1-2026-08-14.md` — ContentsList carrega coleção legacy inteira; Calendar replica projeção localmente; Dashboard faz query dupla; client sem retry/cancelamento. Sem N+1 em render loops. Otimização fica para fases Figma.

## Changes Applied

**Nenhuma mudança funcional ou visual.** F1 é documentation-only:

- `docs/frontend/00-frontend-integration-baseline.md`
- `.dev-reports/looply-f1-frontend-baseline.md`
- `.dev-reports/security-audit-f1-2026-08-14.md`
- `.dev-reports/performance-audit-f1-2026-08-14.md`

## Validation

| Command | Exit | Result |
|---|---:|---|
| `npm --prefix frontend run typecheck` | 0 | PASS |
| `npm --prefix frontend run test` | 0 | PASS (5/5) |
| `npm --prefix frontend run build` | 0 | PASS |
| `npm --prefix frontend audit` | — | 7 findings (classificados; nenhum fix) |
| `npm --prefix backend run typecheck` | 0 | PASS |
| `npm --prefix backend run test` | 0 | PASS (141/141) |
| `npm --prefix backend run build` | 0 | PASS |
| `git diff --check` | 0 | PASS |

## Backend Regression

Sem mudanças backend; regressão verde (141/141).

## Code Review

1. Nenhuma mudança de código frontend/backend — impossível redesign acidental.
2. Nenhum bridge removido (callers ativos mapeados).
3. Nenhum upgrade de dependência.
4. Nenhum arquivo dirty capturado no stage.
5. Migração matrix baseada em evidência de grep/read, não placeholders.

## Changed Files

- `docs/frontend/00-frontend-integration-baseline.md` (novo)
- `.dev-reports/looply-f1-frontend-baseline.md` (novo)
- `.dev-reports/security-audit-f1-2026-08-14.md` (novo)
- `.dev-reports/performance-audit-f1-2026-08-14.md` (novo)

## Preserved Preexisting Dirty Files

Todos os 14 tracked dirty + 8 untracked preservados fora do stage.

## Migration Matrix

| Current Area | Current API | Canonical API | Legacy Dependency | Target Phase | Action |
|---|---|---|---|---|---|
| Login | /api/auth/login | same | — | F3 | Estender session model + first-login |
| Protected shell | /api/auth/me | same + workspace | capabilities ausentes | F3 | Auth/workspace context |
| Dashboard | /api/dashboard | same canonical sections | counts/recent legacy | F4 | Trocar types/sections |
| Clients | /api/clients | same | — | F5 | Adotar tipos canônicos |
| Contents list | /api/contents | /api/jobs | Content bridge | F6 | Trocar contrato query |
| Content detail | /api/contents/:id | /api/jobs/:id | media/version/approval legacy | F6/F7 | Separar Job/Files/Approval |
| New Content | POST /api/contents | POST /api/jobs | social fields | F6 | Fluxo Figma Job |
| Grouping | /api/contents/:id/group | comportamento Job/workflow | grouping legacy | F6 | Decidir sobrevivência no Job genérico |
| Calendar | /api/publications | /api/calendar | publication bridge | F8 | Range projection |
| Public approval | /api/public/approvals/:token | same | type drift | F7 | Atualizar contrato |
| Team GET | /api/team | members routes | read-only legacy | F9 | Members/invitations |
| Team POST | POST /api/team | invitation/provisioning | 410 | F9 | Remover caller/UI |
| Files | — | /api/jobs/:jobId/files, /api/files/* | sem caller | F7 | Novo fluxo Figma |

## Deferred to F2

- API client foundation (error policy 401/403/409/429/503, cancelamento, normalização).
- Eliminar fetch diretos em ContentsList.
- Capability/workspace context primitive.
- Design system/App Shell Figma.
- Testes de foundation (api client, guards).
- Decisão React Router v7.

## Risks

- Approval token drift pode quebrar ContentDetail atual quando backend sanitiza Approval (mitigado: bridge `/api/contents` ainda inclui approvals com legacy token? **Não** — B9 removeu token do DB; o detail page monta approvalUrl só se `latestApproval?.token` existe, então degrada para null de forma segura).
- Coverage de testes estreita antes das telas novas.
- React Router advisory permanece até decisão de upgrade.

## Suggested Commit

`docs(frontend): map integration baseline`

## Next Phase

F2 — Foundations + Components + App Shell
