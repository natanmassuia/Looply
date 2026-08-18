# Looply — V1 Copy Sync Independent Audit

Date: 2026-08-18 · Branch: `main` · Audit-only (no source modified, no commit, no push).

## Baseline

```
REPO_ROOT:           /opt/looply
CURRENT_BRANCH:      main
LOCAL_HEAD:          1937280e829b2d1f63455b6a42d11269936360c1
ORIGIN_MAIN:         1937280e829b2d1f63455b6a42d11269936360c1 (match)
WORKTREE:            4 modified frontend files + 1 untracked report
STAGED:              none
RAM:                 ~1.7 Gi available
git diff --check:    PASS
KORE_TOUCHED:        NO
```

## Files audited

```
frontend/src/features/Onboarding.tsx   (jobs → demandas ×3)
frontend/src/features/Dashboard.tsx    (supporting copy)
frontend/src/features/ContentsList.tsx (Demandas page subtitle)
frontend/src/features/Team.tsx         (Team page subtitle)
frontend/src/features/Login.tsx        (read-only, auth MATCH)
backend/src/services/onboardingService.ts, memberService.ts (read-only, password rule)
frontend/src/features/Clients.tsx, backend/src/services/appointmentService.ts (read-only, responsável conflicts)
```

## Source diff purity

All 6 source changes are **string literals only**: 4 PageHeader/subtitle lines, 1 Dashboard `<p>` supporting string, 3 onboarding prep-list items. No logic branches, handlers, routing, state, props-affecting-behavior, CSS, component structure, query/filter, or API changes. **COPY_ONLY_DIFF: PASS.**

## Terminology audit

- **Visible `Job`/`jobs`**: after the Onboarding fix, **0 user-visible occurrences remain** (grep across features/components/lib). No internal identifier renamed.
- **Onboarding "jobs"→"demandas"**: refers to the operational work object (PROFILE_PREP checklist), grammar correct ("Clientes e demandas organizados" — mixed-gender compound takes masculine plural). **SAFE.**
- **`Conteúdo`/`conteúdo`**: remaining occurrences are all in the approval/content domain ("Revisão de conteúdo", "aprovou o conteúdo", "Agendar conteúdo") — the precise product term for the approved artifact, distinct from the operational "Demandas" object. Correctly retained.
- **DEMANDAS_TERMINOLOGY: CONSISTENT.**

## Dashboard review

- Supporting copy is exactly "O que precisa da sua atenção hoje." — and `login.test.tsx:141` already asserts this exact string, so the change aligns runtime with an existing canonical assertion (no test weakened, no duplication).
- KPI "Agendados" retained vs Figma "Vencem hoje": runtime KPI reflects the **actual scheduled-count metric** navigating to /calendar; no "due today" metric is computed. **ACCEPTABLE_RUNTIME_AUTHORITY** (genuine runtime truth, not accidental drift).
- Section "Demandas em andamento" vs Figma "Atividade recente": runtime shows only recent demands (not files/approvals activity); renaming would overstate. **ACCEPTABLE_RUNTIME_AUTHORITY.**

## Demandas list copy

Subtitle "Acompanhe o fluxo de trabalho por etapa, cliente e responsável." — verified the runtime board actually exposes: **etapa** (WorkflowStage columns), **cliente** (client filter + grouping), **responsável** (responsible shown on cards). **Accurate, not misleading.** Single subtitle variant used (matches desktop supporting copy); no contradictory mobile variant present. **DEMANDAS_MOBILE_CONSISTENCY: acceptable.**

## Team copy

Subtitle "Gerencie quem participa do Looply e mantenha os papéis de cada pessoa claros." — Team screen manages members + roles (role filter/select, member editing, invites). **Accurate, no unsupported permissions claim.**

## Auth copy (MATCH)

Login strings verified identical to the canonical contract: "Acesso ao Looply", "Bem-vindo de volta.", "Entre para continuar o trabalho da sua equipe.", "E-mail"/"Senha", "Esqueci minha senha", "Entrar", "Precisa de ajuda para entrar?" + admin-contact support copy. No change made.

## Behavior conflicts (independently verified)

- **A. Password rule**: backend `assertNewPasswordOk` enforces `length < 10` (MIN_PASSWORD_LENGTH=10, max 200). Visible runtime rule text is "Entre 10 e 200 caracteres" — **accurately communicates 10+**. The implementation correctly did NOT change to Figma's "8+ caracteres" (which would be a HIGH usability/contract mismatch). **CONFIRMED correct.**
- **B. Clients "responsável"**: runtime client search filters name, primaryContactName, primaryContactEmail, and channels — **no "responsável"**. Runtime placeholder "Buscar cliente por nome, contato, canal…" is accurate; Figma's "…ou responsável" was correctly NOT applied. **CONFIRMED correct.**
- **C. Calendar "responsável"**: Appointment domain has title, description, clientId, startsAt, endsAt — **no responsible field**. Runtime subtitle "Planejamento, publicações e compromissos" does not promise responsible data. **CONFIRMED correct.**

## Variants (acceptable)

- **PublicApproval** "Aprovar"/"Solicitar alteração" vs "Aprovar versão"/"Solicitar ajustes": concise, semantically correct, established runtime variants describing the version-bound public decision. Not drift.
- **Settings** tab-based "Configurações" vs "Workspace e operação" main-title: reflects the actual current tab-based layout; Figma main title belongs to a different composition variant.

## Desktop/mobile consistency / grammar / overflow

- No contradictory domain meaning between desktop/mobile for touched concepts.
- Grammar on all changed strings correct (Demandas ativas canonical; "Clientes e demandas organizados" correct).
- All changed strings are PageHeader subtitles / a Dashboard paragraph / checklist items — standard flowing text, **no truncation/overflow risk** in constrained controls.

## Test integrity

COPY_ASSERTIONS_UPDATED: 0 is reasonable — no test asserted any changed string, and the Dashboard change aligns with an existing canonical assertion (`login.test.tsx:141`). No test was weakened.

## Findings by severity

**CRITICAL** — none. **HIGH** — none. **MEDIUM** — none. **LOW** — none.

Behavior conflicts (A/B/C) and Figma-stale items (D/E) are all **CONFIRMED** and were correctly **not applied** (preserving runtime truth and avoiding misleading copy).

## Validation actually executed

- `git status/stat/name-status/diff --check`; full diff inspected.
- Terminology greps (Job/jobs/Conteúdo) across frontend.
- Backend password-rule source verified (10+).
- Clients/Calendar responsible-field domain verified (no responsible field).
- Auth strings verified against contract.
- Focused frontend tests: dashboard, login, onboarding, workflowKanban, team → **79 passed** (full suite 305 already green on identical diff; not re-run).

## Consolidation decision

**PASS.** The Copy Sync diff is strictly copy-only, semantically safe, internally consistent, and ready for consolidation. All behavior conflicts and Figma-stale items were correctly preserved as runtime truth, with no misleading copy introduced.

## Git state

```
HEAD:               1937280e829b2d1f63455b6a42d11269936360c1 (unchanged)
Dirty files:        4 modified (copy-only) + 1 untracked report
Staged:             none
Committed/Pushed:   none
git diff --check:   PASS
KORE_TOUCHED:       NO
```

## Tools / skills actually used

- Skills loaded: `caveman`, `kore-validate` (tiered validation; focused suites only).
- No external MCP required (contract externally verified; source/domain inspected via Read/Grep).
