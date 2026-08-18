# Looply — V1 Copy Sync (Figma → Frontend)

Date: 2026-08-18 · Branch: `main` · Worktree left dirty (no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          1937280e829b2d1f63455b6a42d11269936360c1 (matches expected base)
RAM:                 ~1.7 Gi available (no RESOURCE_PRESSURE)
WORKTREE:            started with the previously-blocked partial change (Onboarding jobs→demandas)
KORE_TOUCHED:        NO
```

## Authority

This OpenCode session still has **no Figma MCP**. That is no longer a blocker: the canonical Figma copy was **externally verified from the live canonical file** (Looply — Brand & Product, key `8JDixNLJNe1f3KVPRwEFBi`) and the verified copy contract was supplied to this execution. `FIGMA_AUTHORITY: EXTERNALLY_VERIFIED_LIVE_FIGMA`. No live Figma access was attempted; no stale remembered strings were used.

## Comparison classification

For each relevant runtime string I classified internally as MATCH / COPY_DRIFT / RUNTIME_ONLY / FIGMA_VARIANT / BEHAVIOR_CONFLICT / FIGMA_STALE.

## Changed copy (COPY_DRIFT, applied)

| Surface | File | Before | After |
|---|---|---|---|
| Onboarding `PROFILE_PREP` (×3) | Onboarding.tsx | "Clientes e jobs organizados" | "Clientes e demandas organizados" |
| Dashboard supporting | Dashboard.tsx | "Acompanhe o que está acontecendo com sua operação." | "O que precisa da sua atenção hoje." |
| Demandas page subtitle | ContentsList.tsx | "Fluxo operacional de demandas e aprovações" | "Acompanhe o fluxo de trabalho por etapa, cliente e responsável." |
| Team page subtitle | Team.tsx | "Membros da agência e permissões de acesso" | "Gerencie quem participa do Looply e mantenha os papéis de cada pessoa claros." |

All four are proven Figma equivalents that accurately describe runtime behavior and are not misleading. The Dashboard change is corroborated by an existing test assertion (`login.test.tsx:141` expects "O que precisa da sua atenção hoje.").

## Already matching (MATCH — no change)

- **Auth/Login**: Eyebrow "Acesso ao Looply", "Bem-vindo de volta.", "Entre para continuar o trabalho da sua equipe.", "E-mail"/"Senha", "Esqueci minha senha", "Entrar", "Precisa de ajuda para entrar?" + the admin-contact support copy. All match contract A.
- **Demandas page**: title "Demandas", primary "Nova demanda" (contract I).
- **Calendar**: page "Agenda", primary "Novo compromisso" (contract K).
- **Team**: page "Equipe", primary "Convidar membro" (contract L).
- **Settings**: page "Configurações" (contract O).
- **Dashboard**: "Atenção agora", "Próximas agendas", "Demandas ativas", "Em aprovação", "Ver demandas"→/contents, max-3 attention rows, no "Nova demanda" on final Dashboard (contract G).
- **Terminology**: "Demandas ativas" already corrected (no "Demandas ativos"); customer-facing "Demandas" canonical.

## Figma variants resolved (FIGMA_VARIANT — kept runtime variant, not misleading)

- **Change Password (forced)**: runtime title "Defina sua nova senha." matches contract B; body "Proteja seu acesso antes de continuar." matches the approved alternative variant ("…antes de continuar o setup."). Kept.
- **Public Approval actions**: runtime "Aprovar" / "Solicitar alteração" vs contract "Aprovar versão" / "Solicitar ajustes". Runtime variants accurately describe the version-bound public decision; kept.

## Behavior conflicts (BEHAVIOR_COPY_CONFLICT — not applied, reported)

- **Change Password rules**: contract B says "8+ caracteres, 1 número, 1 letra maiúscula"; runtime backend enforces **10+ characters** (`assertNewPasswordOk`). Applying 8-char copy would mislead; kept runtime rule text.
- **Clients subtitle/placeholder**: contract "Busque pelo nome, contato ou responsável…" — runtime client search covers name, contact, and **channel**, not "responsável". Applying "responsável" would misstate the search; kept runtime "Marcas e empresas atendidas" / "Buscar cliente por nome, contato, canal…".

## Stale Figma / runtime-authority items (FIGMA_STALE / RUNTIME_ONLY)

- **Dashboard KPI "Agendados"** (runtime) vs contract "Vencem hoje": runtime KPI reflects the actual scheduled-count metric navigating to /calendar; "Vencem hoje" is a different (not-computed) metric. Kept "Agendados" as runtime truth.
- **Calendar subtitle** "Planejamento, publicações e compromissos": accurate to runtime (appointments + publications); contract's "…e responsável" overstates appointment data (no responsible field on appointments). Kept.
- **Settings subtitle** "Gerencie suas preferências…": runtime Settings is tab-based with "Configurações" as page title; contract's "Workspace e operação" main title corresponds to a different structure. Kept.
- **Demand detail / Client detail**: runtime copy is domain/version-specific and accurate; no clean non-misleading Figma-only string warrants a change beyond what is listed.

## Terminology audit (contract Q)

- Visible `Job`/`Jobs` occurrences: only Onboarding `PROFILE_PREP` (operational work items) → **fixed to "Demandas"**.
- Visible `Conteúdo`/`conteúdo`: all in the approval/content domain ("Revisão de conteúdo", "aprovou o conteúdo", "Agendar conteúdo") — legitimate precise product term for the approved artifact, distinct from the operational "Demandas" object; **kept**.
- `DEMANDAS_TERMINOLOGY: CONSISTENT`.

## Files changed

```
frontend/src/features/Onboarding.tsx     jobs → demandas (3 strings)
frontend/src/features/Dashboard.tsx      supporting copy → "O que precisa da sua atenção hoje."
frontend/src/features/ContentsList.tsx   Demandas page subtitle → Figma desktop supporting copy
frontend/src/features/Team.tsx           Team page subtitle → Figma supporting copy
```

`COPY_ASSERTIONS_UPDATED: 0` — no test asserted any changed string (the Dashboard test already expected the corrected string).

## Tests / validation

- Focused (dashboard, login, team, onboarding, workflowKanban, clients): **96 passed**.
- Full frontend suite: **305 passed** (20 files).
- Frontend `tsc --noEmit`: PASS · build: PASS.
- `git diff --check`: PASS.
- Backend N/A (no backend change).

## Backend / schema / migration

```
BACKEND_CHANGE: NO
SCHEMA_CHANGE: NO
MIGRATION: NO
```

## Runtime spot-check

All changed strings are short PageHeader subtitles / a Dashboard paragraph (standard flowing text) — no truncation or button-width risk. No layout change made.

## Remaining copy drift / limitations

- The Dashboard "Demandas em andamento" section vs contract "Atividade recente": runtime shows only recent demands (not files/approvals activity); renaming to "Atividade recente" with the contract's "Últimas mudanças em demandas, arquivos e aprovações" would overstate runtime content. Reported as behavior-bound; kept accurate runtime heading.
- Clients/Calendar "responsável" overstatements and the ChangePassword 8-char rule remain behavior conflicts with runtime (reported, not applied).

## Git state

```
HEAD:               1937280e829b2d1f63455b6a42d11269936360c1 (unchanged)
Dirty files:        4 modified (copy-only) + 1 untracked report
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## MCPs / skills actually used

- Skills loaded: `caveman`, `kore-validate`.
- No Figma MCP in this session (not required — contract externally verified); no other external MCP used.
