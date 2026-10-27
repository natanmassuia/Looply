# Auditoria de consistência entre telas + jargão exposto

**Data:** 2026-10-27 · **Escopo:** apenas relatório (nenhum código alterado).

Duas frentes: (1) a mesma entidade aparecendo com dados/rótulos diferentes entre
Dashboard, Demandas, Inbox e Agenda; (2) termos técnicos que o cliente final não
entende.

---

## Tabela A — Consistência de entidades

| Entidade | Onde aparece (arquivo:linha) | Divergência | Fonte de verdade sugerida |
|---|---|---|---|
| **Cliente — avatar/cor de fallback** | `Clients.tsx:528,775` (`brandColor ?? "#475569"`); `ContentsList.tsx:395,509,867` (`brandColor \|\| "#94a3b8"`); `ClientDetail.tsx:113` (`brandColor \|\| "#F06D55"`); `Dashboard.tsx:360` ClientDot (`color \|\| "#94a3b8"`) | **Três cores de fallback diferentes** (`#475569`, `#94a3b8`, `#F06D55`) para o mesmo caso "cliente sem brandColor". `#F06D55` é o coral da marca; os outros são cinzas aleatórios. | Um único helper de avatar/cor (ex.: fallback sempre token `--looply-color-text-muted` ou o coral). Hoje nenhum usa token — todos hardcoded. |
| **Cliente — iniciais** | `ClientDetail.tsx:115` (`name.charAt(0)` → 1 letra); `Clients.tsx:530,777` e `ContentsList.tsx:397,511` (`name.slice(0,2)` → 2 letras); `ContextPanel.tsx:80` (`initials()` de `format.ts`) | Mesma entidade rende **1 letra, 2 letras ou via `initials()`** conforme a tela. Só `ContextPanel` usa o helper central `initials()`. | Usar `initials()` de `frontend/src/lib/format.ts` em todas. |
| **Cliente — contagem de demandas ativas** | `Clients.tsx:117,130-133` usa `c.activeContents` (campo do backend); `ClientDetail.tsx:215` **recalcula** `clientDemands.filter(d => d.status !== "PUBLISHED" && d.lifecycleStatus !== "CANCELLED").length` | Duas definições de "ativo": o backend (`activeContents`) e o filtro local do ClientDetail podem **divergir no número** mostrado para o mesmo cliente. | Definir "ativo" no backend e expor via `activeContents`; ClientDetail consome o mesmo campo. |
| **Cliente — fonte dos dados** | `useClients()` em `ContextPanel.tsx:17`, `ContentsList.tsx`, `Clients.tsx`; `ClientDetail.tsx` usa detalhe próprio; `Dashboard`/`ContentsList` leem `c.client` embutido na demanda | Dashboard e lista de demandas mostram `client` **aninhado na demanda** (subset: `name`, `brandColor`), enquanto Clients/ContextPanel leem a entidade `Client` completa. Subset pode ficar defasado (ex.: logo novo não aparece na demanda). | `useClients()` como fonte única; telas de demanda resolvem o cliente por id em vez de confiar no subset aninhado. |
| **Agendamento — formatação de hora** | `Dashboard.tsx:296` usa `formatAppointmentLine(ev.at, timeZone)` (respeita `Company.timezone`); `Calendar.tsx:41` usa `` `${pad2(d.getHours())}:${pad2(d.getMinutes())}` `` (**hora local do browser**); `ContentDetail.tsx:309,416` usa `formatDate(...)` (**só data, sem hora**) | Mesmo evento aparece com **hora em timezone do workspace (Dashboard), hora do browser (Agenda) e sem hora (Demanda)**. Em fuso diferente do workspace, Dashboard e Agenda mostram horas distintas. | Padronizar nos helpers de `lib/format.ts` (`formatInTimeZone`/`formatAppointmentLine`) com `Company.timezone`. Calendar deve parar de usar `getHours()` cru. |
| **Agendamento — fonte/campo** | `Calendar.tsx:103,141,835` usa `scheduledAt ?? publicationTarget`; `Dashboard` lê `upcomingEvents` (projeção com `ev.at`); `ContentDetail.tsx:416` mostra só `publicationTarget` | Ordem de precedência `scheduledAt ?? publicationTarget` existe na Agenda mas **não** na Demanda (que só mostra `publicationTarget`). Usuário vê datas diferentes para a mesma demanda. | Uma função única "data efetiva da demanda" (`scheduledAt ?? publicationTarget`) reusada por Agenda, Dashboard e ContentDetail. |
| **Agendamento — link de destino** | `Dashboard.tsx:291` (`jobId → /contents/:id`, `appointmentId → /calendar`, senão `/contents`); `Calendar.tsx:868` (`/contents/:id`) | Agendamento avulso (sem job) no Dashboard leva a `/calendar` **genérico**, não ao evento específico. Inconsistente com a demanda, que abre o detalhe. | Mesmo padrão de deep-link; se não há rota de detalhe de appointment, documentar como limitação. |
| **Conversa ↔ cliente (vínculo)** | Definido/editado só em `ContextPanel.tsx:33-35,97-145` (`useBindConversationClient`); exibido como `conversation.client?.name` | O vínculo conversa→cliente vive só no Inbox. Clients/ClientDetail/Dashboard **não mostram** quais conversas pertencem a um cliente — informação assimétrica. | Expor "conversas vinculadas" também em ClientDetail, lendo o mesmo vínculo (`conversation.client`). |

---

## Tabela B — Jargão técnico exposto ao usuário

| Termo atual | arquivo:linha | Reescrita client-friendly (pt-BR) |
|---|---|---|
| "versão de demonstração" | `Settings.tsx:877` | "versão de avaliação" / "ambiente de testes" |
| "Meta Cloud API" | `Settings.tsx:867` | "WhatsApp oficial" (já há "WhatsApp oficial" na mesma frase — remover o parêntese técnico) |
| Badge "WhatsApp Cloud API" | `ContextPanel.tsx:91` | "WhatsApp oficial" ou só "WhatsApp" |
| "Status da integração" | `Settings.tsx:875` | "Status da conexão" |
| "Governança da IA" | `ContextPanel.tsx:163` | "Controle da IA" / "Atendimento automático" |
| "NEEDS_ATTENTION" (valor cru, caso vaze) e rótulo "Requer Atenção" | tipo `types.ts:379`; rótulo `ContextPanel.tsx:180`, `ChatHeader.tsx:186`, `ConversationItem.tsx:74`, `ConversationList.tsx:131` | Rótulo "Precisa de você" / "Atenção humana". **Garantir que o valor cru `NEEDS_ATTENTION` nunca apareça na tela** (sempre passar por rótulo). |
| "Workflow" | `Settings.tsx:325,848`; `WorkflowSettings.tsx:93,99` | "Fluxo de trabalho" / "Etapas" |
| "semanticKey" | `WorkflowSettings.tsx:84,193,218-219` (lógica interna) | Não exposto como texto ao usuário; só controla "etapa protegida" (`WorkflowSettings.tsx:219`). Manter interno — nenhuma reescrita de UI necessária, mas **confirmar que a chave nunca é renderizada**. |

Nota: "Workflow" aparece também como chave interna de aba (`activeTab` em
`Settings.tsx:92`) — essa é interna (não visível); só os rótulos de `:325/:848`
e `WorkflowSettings` são texto de tela.

---

## Resumo

- **Maior risco de consistência:** hora de agendamento (Calendar usa hora do
  browser, Dashboard usa timezone do workspace — `Calendar.tsx:41` vs
  `Dashboard.tsx:296`) e contagem de demandas ativas com duas definições
  (`Clients.tsx:117` vs `ClientDetail.tsx:215`). Ambos podem mostrar números/horas
  diferentes para o mesmo dado.
- **Cosmético mas visível:** três cores de fallback de avatar e iniciais com 1 vs
  2 letras — unificar via `initials()` e um token de cor.
- **Jargão:** trocar "Meta Cloud API"/"WhatsApp Cloud API"/"versão de demonstração"
  /"Governança da IA"/"Workflow" por termos simples; garantir que `NEEDS_ATTENTION`
  e `semanticKey` nunca cheguem crus à tela.
