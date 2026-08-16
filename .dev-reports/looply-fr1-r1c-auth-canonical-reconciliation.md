# FR1-R1C — Auth Canonical Reconciliation

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **HEAD Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Frontend Test Baseline**: 145 tests PASS (all Auth / Onboarding tests passing; 1 pre-existing failure in out-of-scope FR1-R2 shell test preserved).
- **Backend Diff Baseline**: 3 pre-existing dirty files preserved untouched; 0 backend changes in FR1-R1C.

## Sources Reviewed
1. **Figma Visual Authority**: `05.1 — Auth Experience` (File `8JDixNLJNe1f3KVPRwEFBi`)
2. **Figma Functional/State Authority**: `05 — Access & Onboarding`
3. **Notion Contract**: `Looply — Produto, Arquitetura e Roadmap V1` (Task: *Implementar login, logout e sessão persistente*)
4. **Completed Task Reports**: `FR1-A`, `FR1-R1`, `FR1-R1B`

## Figma Contract
- Visual composition for desktop Auth uses a split container: left Product Story (inverse aubergine `#2A171F` background, 760px), right Auth Panel (surface `#FFFFFF`, 440px form column).
- Mobile composition uses a compact 390px layout with an interactive preview card positioned cleanly above the auth form.
- Frame `07 — Interactive Product Preview` is the canonical product showcase, featuring 4 interactive views: `Visão geral`, `Clientes`, `Jobs`, and `Agenda`.
- Human Relay logo lockup is the canonical brand asset (48px desktop, 32px mobile).

## Notion Contract
- `05.1 — Auth Experience` is the visual reference for Auth and first access.
- `05 — Access & Onboarding` is the functional sequence authority.
- The phrase `Looply — um produto Verbum Lab` must NOT appear as a product signature in the Auth UI.
- Verbum Lab appears strictly when genuinely relevant to support / provisioning.
- Benefit chips / marquee ticker are obsolete and replaced by the interactive Product Preview.

## Authority Resolution
- Functional onboarding sequence is maintained in full: `Login` → `Change Password` → `Welcome` → `Company` → `Profile` → `Template Confirmation` → `Meta` → `Appearance` → `Ready` → `App`.
- No functional onboarding steps were removed or collapsed based solely on static frames in 05.1.
- Visual styling follows 05.1; state flow follows 05.

## Pre-Fix Audit Matrix

| Audit Area | Pre-Fix Status | Classification | Action Taken |
| :--- | :--- | :--- | :--- |
| **Human Relay Brand** | Canonical in `Logo.tsx` (168x168, #F06D55, #F3B84B, #2A171F) | `MATCH` | Preserved untouched |
| **Verbum Lab Footer** | Rendered in `AuthShell.tsx` and `Login.tsx` as product signature | `OBSOLETE` / `NEEDS_FIX` | Removed from rendered Auth UI |
| **Benefit Chips & Marquee** | Static chips on desktop + CSS marquee track on mobile | `OBSOLETE` | Removed completely along with CSS keyframes |
| **Product Preview** | Static card with non-interactive mock content | `NEEDS_FIX` | Implemented canonical `AuthProductPreview` with 4 interactive local tabs |
| **Auth Copy** | Stale copy in Login ("Entre com seu e-mail e senha", generic reset notice) | `NEEDS_FIX` | Reconciled to canonical Figma 05.1 copy and honest recovery message |
| **Change Password Copy** | Contained "continuar a configuração" / stale text | `NEEDS_FIX` | Reconciled to "Proteja seu acesso antes de continuar." |
| **Workspace Residuals** | "Sua empresa está no ar" / "blank canvas" / technical phrasing | `NEEDS_FIX` | Normalized to "Seu Looply está pronto para começar.", "Tudo pronto" |
| **Onboarding Flow** | 7 functional steps with honest Meta and Appearance | `FUNCTIONAL_ONLY` | Preserved all 7 steps with real API contracts |
| **Meta Connection** | Honestly deferred status card without fake OAuth | `MATCH` | Preserved honest blocked/deferred state |
| **Password Recovery** | Honest notice without fake reset API | `MATCH` | Preserved honest helpful message |

## Valid Existing Work
- Single runtime authority `Logo.tsx` for Human Relay brand mark.
- AccessGate routing logic and server-driven session protection.
- Real API endpoints: `PATCH /api/onboarding/company`, `POST /api/onboarding/template`, `PATCH /api/onboarding/appearance`, `POST /api/onboarding/complete`, `POST /api/auth/change-password`.

## Obsolete Previous Decisions
- F4C / F4C-R1 presentation-only benefit chips (`["Clientes + Jobs", "Aprovação pública", "Agenda + WhatsApp"]`).
- CSS marquee animation (`looply-marquee`) and duplicated accessible sequences.
- Verbum Lab product signature footer in the Auth Shell and Login screen.

## Verbum Lab Footer
- Removed `Looply — um produto Verbum Lab.` from `AuthShell.tsx` aside.
- Removed `O Looply é um produto Verbum Lab.` from `Login.tsx`.
- Retained clean, helpful support copy directed to company administrators.

## Human Relay Verification
- `Logo.tsx` is strictly consumed in `AuthShell.tsx`, `Sidebar.tsx`, etc.
- No SVG duplication or generic stacked-layer icon anywhere in Auth.
- Tested 1:1 aspect ratio and accessible naming across 48px, 42px, and 32px sizes.

## Product Preview
- Implemented `AuthProductPreview` component with 4 interactive local views:
  1. **Visão geral (`overview`)**: Status indicator "Operação em dia", "Trabalho em movimento", metrics for active jobs (12) and pending approval (3), recent job entries, and illustrative signals.
  2. **Clientes (`clients`)**: Active portfolio showcase ("Studio Aurora", "Café Moema", "Ótica Solaris").
  3. **Jobs (`jobs`)**: Weekly delivery breakdown ("Reels — lançamento", "Carrossel — promoção", "Story — bastidores").
  4. **Agenda (`calendar`)**: Publishing schedule with timestamps and assigned clients.
- Fully local state (`useState<PreviewTab>("overview")`), zero global store, zero API fetching, zero router navigation.
- Accessible `<button>` controls with `aria-current` (desktop) and `role="tab"` / `aria-selected` (mobile).

## Removed Benefit Marquee
- Deleted `BENEFITS` array from `AuthShell.tsx`.
- Deleted `.marquee-track`, `.marquee-seq`, `@keyframes looply-marquee`, and `@media (prefers-reduced-motion: reduce)` from `frontend/src/index.css`.
- Removed obsolete marquee tests in `login.test.tsx`.

## Auth Copy
- Desktop Login Eyebrow: `Acesso ao Looply`
- Title: `Bem-vindo de volta.`
- Subtitle: `Entre para continuar o trabalho da sua equipe.`
- Recovery link: `Esqueci minha senha`
- Recovery status notice: `A recuperação de senha ainda não está disponível. Fale com quem administra o Looply na sua empresa.`
- Help card: `Se ainda não recebeu seu acesso, fale com quem administra o Looply na sua empresa. Seu acesso é exclusivo para a sua equipe.`

## Workspace Residuals
- Eliminated all customer-facing instances of "workspace" in runtime strings.
- Replaced "Sem blank canvas..." with "O Looply já vem com fluxo de clientes, jobs e aprovações organizado para o perfil da sua empresa."
- Step 7 Onboarding Eyebrow: `Tudo pronto`
- Step 7 Onboarding Headline: `Seu Looply está pronto para começar.`

## Mobile Auth
- 390px mobile viewport renders compact header with `Logo size={32}` + `Tudo em um só fluxo`.
- Interactive `AuthProductPreview compact` renders compact horizontal tabs directly above the auth form.
- No horizontal overflow, no layout collisions, no desktop split leakage.

## Onboarding Functional Flow
- Step 1: `Welcome`
- Step 2: `Company` (Name, Website, Timezone, Locale)
- Step 3: `Profile` (Local Business, High-Ticket, Marketing Agency)
- Step 4: `Template Confirmation` (Explains configured areas)
- Step 5: `Meta` (Honest status card, WhatsApp/Instagram "Em breve")
- Step 6: `Appearance` (AURA default, Flux, Pulse, Custom disabled)
- Step 7: `Ready` (Accurate summary reflecting selected values, CTA: "Entrar no Looply")

## Profile
- Preserved all 3 canonical profiles: `LOCAL_BUSINESS`, `HIGH_TICKET`, `MARKETING_AGENCY`.
- Preserved backend contract `POST /api/onboarding/template`.

## Template Confirmation
- Explains areas configured without exposing internal flags or technical jargon.
- Purely presentational step between Profile and Meta.

## Meta Truthfulness
- Retains honest "Em breve" status card.
- No simulated OAuth, no fake connection state in localStorage or memory.
- Preview illustrative signal is marked `aria-hidden="true"` and decoupled from actual integration status.

## Appearance
- Preserved theme presets (AURA, FLUX, PULSE, CUSTOM).
- Preserved `PATCH /api/onboarding/appearance` contract with light/dark support.

## Ready
- Reconciled headline to `Seu Looply está pronto para começar.`.
- Summary list reflects exact form state from current session.

## Recovery
- Honest fallback notice preserved on forgot password button.
- No fake endpoints or simulated password reset emails.

## Accessibility
- Tab navigation in preview uses semantic `<button>` elements with `aria-current` (desktop) and `role="tab"` / `aria-selected` (mobile).
- Decorative preview cards and signals carry `aria-hidden="true"` to prevent screen reader clutter.
- Auth form inputs have explicit `<label htmlFor="...">`, `autoComplete`, and required validation.

## Tests Updated
- `frontend/src/tests/login.test.tsx`:
  - Verified removal of Verbum Lab product signature footer.
  - Verified honest recovery notice copy.
  - Verified semantic inverse color tokens in desktop aside.
  - Verified removal of obsolete marquee CSS and chips.
- `frontend/src/tests/onboarding.test.tsx`:
  - Updated step 7 assertion to match "Seu Looply está pronto para começar."

## Tests Added
- `frontend/src/tests/login.test.tsx`:
  - `product preview defaults to Visão geral and renders overview metrics`
  - `user can interactively switch between preview tabs locally without routing` (testing Clientes, Jobs, Agenda switches)

## Typecheck
- Command: `npm --prefix frontend run typecheck`
- Result: **0 errors (PASS)**

## Build
- Command: `npm --prefix frontend run build`
- Result: **Vite production bundle built successfully (PASS)**

## Backend Diff
- Backend diff introduced in FR1-R1C: **ZERO (0 lines changed)**.
- Pre-existing backend dirty files preserved untouched.

## Pre-existing Dirty Preservation
- All pre-existing modified files outside of FR1-R1C scope (including `AppLayout.tsx`, `Sidebar.tsx`, `Calendar.tsx`, `Dashboard.tsx`, `Team.tsx`, `NewContent.tsx`, `PublicApproval.tsx`, etc.) were strictly preserved.

## Post-Fix Runtime Copy Audit
- `workspace`: 0 customer-facing runtime strings (only TypeScript types, imports, and radio input names).
- `produto Verbum Lab`: 0 occurrences in rendered UI.
- `blank canvas`: 0 occurrences.
- `setup`: 0 customer-facing occurrences.
- `provisionado`: 0 customer-facing occurrences.

## Remaining Out-of-Scope Findings
- `FR1-R2`: Authenticated mobile app shell bottom nav / secondary drawer (separate task).
- `FR1-R3`: PublicApproval token migration and shared geometry remediation (separate task).
- `F5`: Dashboard migration (separate task).

## Visual Runtime Review Requirement
- Marked: `VISUAL_RUNTIME_REVIEW_REQUIRED` for final browser/screenshot inspection across 1440x960 desktop and 390x844 mobile viewports.

## Ponytail Lite Review
- Minimal, clean solution using React local state for preview switcher.
- No unnecessary dependencies or external animation libraries added.
- Zero over-engineering; YAGNI principles respected.

## Git Status
- Working tree clean of accidental changes; pre-existing dirty files preserved.
- No files staged or committed.

## Final Status
- FR1-R1C Canonical Reconciliation Complete.
