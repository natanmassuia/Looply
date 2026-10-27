# Dashboard de atendimento + status real de integração WhatsApp

**Data:** 2026-10-27 · **Escopo:** apenas relatório. Nenhum código alterado, sem migração.

Problema: o core é WhatsApp + agenda, mas o Dashboard mostra só pipeline de
conteúdo (demandas) e a aba Integrações exibe status **fixo/falso**. Abaixo,
apenas o que o backend **já expõe sem migração**.

---

## 1. Dashboard atual (o que o backend já retorna)

Fonte: `backend/src/services/dashboardService.ts` → `getDashboardForCompany`,
exposto em `backend/src/routes/dashboard.ts`. Consumido por
`frontend/src/features/Dashboard.tsx`.

Retorno de hoje (tudo tenant-scoped por `companyId`):

- `summary.clients.active`, `summary.jobs` (open/inProgress/completed/cancelled/total),
  `summary.team.active`, `summary.byStage` (se WORKFLOW).
- `attention.jobs` (status `AWAITING_CLIENT`/`CHANGES_REQUESTED`), `pendingApprovals`,
  `changesRequestedApprovals`, `upcoming` (via `getCalendar`, janela 7 dias).
- `recent.jobs` (5 últimas demandas), `recent.activity`.
- `counts.*` (legacy) + `recentContents` + `needingAttention`.

**Nenhum dado de atendimento** (`Conversation`, `aiStatus`, mensagens) entra no
dashboard hoje. Agenda já vem via `upcoming` (7 dias).

---

## 2. KPIs de atendimento viáveis JÁ (sem migração)

Cada um sai de tabela/campo que já existe. Origem exata e custo de query:

| KPI | Origem exata (tabela.campo) | Query | Custo |
|---|---|---|---|
| Conversas por status da IA (ACTIVE / PAUSED / NEEDS_ATTENTION) | `Conversation.aiStatus` (enum `ConversationAiStatus`, `schema.prisma:135`), filtro `companyId` | `conversation.groupBy({ by: ["aiStatus"], where: { companyId }, _count })` | Baixo, mas **sem índice dedicado** por `(companyId, aiStatus)` → scan filtrado por `companyId`. Volume por empresa é pequeno; aceitável. Índice composto ajudaria, mas **exige migração** (fora do escopo). |
| Conversas precisando de atenção | `Conversation.aiStatus = NEEDS_ATTENTION`, `companyId` | `conversation.count({ where: { companyId, aiStatus: "NEEDS_ATTENTION" } })` | Baixo (sai do mesmo `groupBy` acima — não fazer query extra). |
| Conversas com mensagem hoje | `Conversation.lastMessageAt >= início do dia` (no timezone da empresa), `companyId` | `conversation.count({ where: { companyId, lastMessageAt: { gte: startOfDay } } })` | **Barato** — usa índice existente `@@index([companyId, lastMessageAt])`. |
| Mensagens não lidas (total) | `Conversation.unreadCount` (`schema.prisma`), `companyId` | `conversation.aggregate({ _sum: { unreadCount }, where: { companyId } })` ou `count where unreadCount > 0` | Baixo; sem índice em `unreadCount`, mas o scan é por `companyId`. |
| Agendamentos de hoje | `Appointment.startsAt` entre início/fim do dia, `status = SCHEDULED`, `companyId` | `appointment.count({ where: { companyId, status: "SCHEDULED", startsAt: { gte, lt } } })` | **Barato** — índice existente `@@index([companyId, startsAt])`. |
| Agendamentos da semana | mesmo, janela de 7 dias | idem com range de 7 dias | **Barato** (mesmo índice). |
| Demandas ativas | `Job.lifecycleStatus IN (OPEN, IN_PROGRESS)`, `companyId` | já calculado em `summary.jobs.open + inProgress` | **Zero** — já vem no dashboard. |

Observações (supabase-postgres-best-practices):
- "Início do dia" deve usar `Company.timezone`, não o fuso do servidor — senão o
  KPI "hoje" fica errado para empresas em outro fuso (mesmo problema do
  `Calendar.tsx` já notado em `consistencia-e-jargao.md`).
- O `groupBy(aiStatus)` entrega os 3 contadores numa query só; não disparar 3
  `count` separados.
- **Não adicionar** índice `(companyId, aiStatus)` agora (é migração). Registrar
  como melhoria futura se o volume de conversas por empresa crescer.
- Todas as queries continuam tenant-scoped por `companyId` — manter.

---

## 3. Proposta de layout do novo Dashboard (atendimento + agenda primeiro)

**Entra (topo — faixa de KPIs de atendimento):**
1. Conversas precisando de atenção (`NEEDS_ATTENTION`) — número + link para o Inbox filtrado (o filtro já existe: `ConversationList.tsx:131`).
2. Conversas com mensagem hoje.
3. Mensagens não lidas.
4. Agendamentos de hoje (e "da semana" como subtítulo).

**Mantém (coluna direita):** "Próximas agendas" (`upcoming`, 7 dias) — já existe e é core.

**Mantém, rebaixado (coluna esquerda, abaixo do atendimento):** lista de demandas
recentes + "precisa de atenção" (aprovações). Vira resumo secundário, não o herói.

**Sai do topo:** o pipeline de conteúdo (contadores de status editorial
DRAFT/IN_REVIEW/etc.) deixa de ser o destaque principal; permanece acessível mas
sem ocupar a dobra.

Implementação sem inventar dado: estender `getDashboardForCompany` com um bloco
`attendance` (os 4 KPIs da §2, todos condicionais à capability de WhatsApp/Inbox
da empresa, no mesmo padrão `can(Capability.X)` já usado). Nenhuma tabela nova.

---

## 4. Fonte de verdade de "WhatsApp conectado?"

**Estado atual (falso):** a aba Integrações (`Settings.tsx:860-878`) mostra texto
**fixo** — "A conexão com a API oficial do WhatsApp está temporariamente
indisponível nesta versão de demonstração" (`Settings.tsx:877`). Não lê nada do
banco; é string hardcoded.

**Fonte de verdade real (por empresa):** a tabela **`WhatsAppChannel`**. Uma
empresa está conectada quando existe canal:
```
WhatsAppChannel where companyId = X
  AND purpose = CUSTOMER_AI
  AND isActive = true
  AND externalAccountId IS NOT NULL   (Meta phone_number_id)
```
Esse é exatamente o critério que `backend/src/routes/whatsappManagement.ts:71-76`
já usa para decidir quais números pertencem à empresa (`isActive: true`,
`externalAccountId: { not: null }`), e o mesmo canal (`sourcePhoneNumber`) é usado
no envio (`whatsappManagement.ts:91-92`). O `AGENTS.md` confirma:
outbound sai por `WhatsAppChannel.externalAccountId`.

**Endpoint/hook que a aba Integrações deveria consumir:**
- O `GET /api/whatsapp-management/phone-numbers` (`whatsappManagement.ts:69`) já
  reflete conectividade, **mas chama a Graph API da Meta** (`listPhoneNumbers`) —
  caro e pode falhar por rede/token. Não é ideal para um "badge" de status.
- Proposta sem migração: uma checagem **só-DB** reusando a query de
  `WhatsAppChannel` acima (existe ou não um canal ativo com `externalAccountId`).
  Pode ser um campo `whatsapp.connected: boolean` agregado ao próprio
  `GET /api/dashboard` / ao `GET /api/auth/me` (workspace), ou um
  `GET /api/whatsapp/status` leve. A aba Integrações troca a string fixa por esse
  booleano.

Regra: **uma única fonte** (`WhatsAppChannel` ativo) para badge de status,
`/phone-numbers`, e roteamento de envio — evitando o status falso atual e
divergência entre telas.

---

## Resumo

- Dashboard hoje = só pipeline de conteúdo; sem nenhum dado de `Conversation`.
- 4 KPIs de atendimento + 2 de agenda saem **sem migração** de `Conversation`
  (aiStatus/lastMessageAt/unreadCount) e `Appointment` (startsAt); demandas ativas
  já existem. Dois (mensagem hoje, agendamentos) usam índices existentes; os de
  conversa fazem scan por `companyId` (ok no volume atual).
- "Hoje" deve respeitar `Company.timezone`.
- Status de WhatsApp: fonte de verdade = `WhatsAppChannel` (companyId, CUSTOMER_AI,
  isActive, externalAccountId not null). Trocar a string fixa de `Settings.tsx:877`
  por essa checagem só-DB, reusada em todas as telas.
