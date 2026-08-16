# Looply V1 Refactor Baseline (Bateria 0)

## Context
- **Branch:** feature/demo-v1-polish
- **SHA inicial:** 9c0d2b0e4ac8a87f6bf02dd1eb013473b712698b
- **Worktree:** Modificada (arquivos de frontend e backend previamente editados, reports antigos na worktree).

## Skills/MCPs
- Nenhuma dependência não padrão carregada via `kore-validate` ou similar, baseando-se no escopo do sistema atual (Prisma schema inspecionado e AGENTS.md analisado).

## Current-State Summary
O projeto atual é uma "Demo V1" com arquitetura single-tenant. O Prisma schema conta com `User`, `Client`, `Content`, `ContentVersion`, e `Approval`. O domínio "Job" está fortemente atrelado ao conceito de "Content" (formato, publicações, media), voltado a mídias sociais. A aprovação utiliza tokens aleatórios não sequenciais.

## Gap Analysis (Domain Direction)
- O domínio será generalizado: `Content` se tornará `Job`.
- A arquitetura adotará Multi-Tenancy (Workspaces/Companies) onde as entidades pertencerão explicitamente ao tenant.
- A autenticação atual carece de features reais (DEV_DEMO_USER), requerendo a construção de um ciclo de vida de Auth apropriado.

## Decisions
- Mudar para `Job` + `Workflow` para generalizar a plataforma.
- Introduzir `Activity` tracking desde cedo.
- Substituir o usuário chumbado (demo) por auth/session de verdade com suporte a JWT ou session cookies.
- Manter o client web em React (Vite) usando React Query, mas adaptar os contextos e UI paths para lidar com múltiplos tenants e a nova nomenclatura (Job em vez de Content).

## Risks
- Refatoração agressiva do modelo de dados (`Content` -> `Job`) com possível impacto nos endpoints e nos testes.
- Acoplamento do frontend ao conceito "Content", o que exigirá renomeação substancial de componentes.

## Blockers
Nenhum blocker no momento.

## Battery Plan
1. B1 — Foundation
2. B2 — Auth + Multi-tenancy
3. B3 — Members + Onboarding
4. B4 — Clients
5. B5 — Jobs + Workflow + Activity
6. B6 — Kanban
7. B7 — Files
8. B8 — Approval
9. B9 — Calendar
10. B10 — Dashboard
11. B11 — Hardening

## Validation
Nenhum código foi modificado durante a B0. Validação técnica de leitura executada com sucesso.
