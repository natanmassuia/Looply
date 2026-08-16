# V1 Refactor Baseline

## Estado Atual Relevante
O Looply atualmente é um MVP "Demo V1". A base atual foi desenhada com escopo de agências (centrado em `Content`), não possuindo infraestrutura multi-tenant, autenticação persistente escalável, ou perfis de autorização em workspaces.
O banco tem as seguintes tabelas: `User`, `Client`, `Content`, `ContentVersion`, `Approval`.
As rotas de API possuem controllers, services, middlewares (ainda não isolados por tenant). O React utiliza React Query e tem features como Dashboard, Clients, Team, Contents, e Calendar.

## Classificação dos Domínios (Gap Analysis)
| Domain | Decision | Reason |
|--------|----------|--------|
| Auth | REWRITE | Falta suporte real de Auth e sessão. Dependente do demo user. |
| Multi-Tenancy | MISSING | Sistema é single-tenant atualmente. |
| Users / Team | ADAPT | Necessidade de isolar membros por tenant/workspace. |
| Clients | ADAPT | O modelo atende, mas requer tenant ownership e ajustes semânticos. |
| Content -> Job | REWRITE/MIGRATE | Generalização obrigatória para atender além de agências. Renomeação extensiva de tabelas e interfaces. |
| Workflow/Status | ADAPT | Manter validação estrita no backend; adaptar a nova nomenclatura (Job). |
| Files/Storage | ADAPT/MISSING | Uso de object storage com URLs pre-assinadas deverá ser robustecido. |
| Approvals | ADAPT | A segurança de tokens (criptográficos) já existe (KEEP); as amarrações do modelo mudam. |
| Activity/History| MISSING | Deve ser introduzido para audit trail interno. |
| Frontend Shell | KEEP | UI continuará usando React, Vite, React Query; apenas adaptação de rotas. |

## Decisões Aprovadas
- O novo core não assumirá vocabulário de agência (`Content` será `Job`).
- O backend deriva o acesso aos recursos do token de sessão e do tenant selecionado (zero dependência no browser para isso).
- Será utilizada a estratégia incremental de substituição de dados; primeiro criando os modelos, depois refatorando a API e o Frontend.

## Demo Shortcuts
- `DEV_DEMO_USER` no backend (auth bypass) -> **REMOVE**
- Hardcoded user IDs e single-tenant assumptions no banco -> **REMOVE**

## Estratégia de Refatoração
A refatoração será majoritariamente **incremental in-place** para Frontend (mantendo a UI parecida e adaptando domínios), mas será quase um **rewrite parcial/strangler** para os componentes de Backend de Job e Auth.
Mudanças no Prisma vão envolver criar o esquema do V1 (Workspaces, Members), migrando os dados (ou descartando os demo data, o que for aceitável localmente), e modificando a API.
