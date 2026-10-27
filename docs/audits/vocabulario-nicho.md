# Auditoria de vocabulário por nicho — feature "Demandas"

**Data:** 2026-10-27 · **Escopo:** apenas relatório (nenhum código alterado).

Objetivo: mapear todo o vocabulário e o modelo de dados presos ao nicho
editorial (agência de conteúdo / gravação) na feature de Demandas, e propor um
vocabulário neutro que sirva para clínica, comércio e serviços.

Observação de contexto: a navegação e os cabeçalhos **já usam "Demanda"**
(`ContentsList.tsx:344`, `NewContent.tsx:74`). O resíduo editorial está (a) nos
rótulos internos de uma Demanda (legenda, mídia, publicação) e (b) no modelo de
dados (`Content`, `ContentVersion`, `ContentFormat`, papéis editoriais).

---

## 1. Tabela: termo atual → arquivo:linha → proposta neutra

### 1a. Formatos — `ContentFormat` / `FORMAT_LABEL`

| Termo atual | arquivo:linha | Natureza | Proposta neutra |
|---|---|---|---|
| `enum ContentFormat { POST, REELS, STORY, CAROUSEL, VIDEO, IMAGE }` | `backend/prisma/schema.prisma:46` | ESTRUTURAL (enum DB) | Ver §2b — tornar opcional/ocultável por nicho |
| `format: z.enum(["POST","REELS",...])` | `backend/src/lib/validation.ts:32` | ESTRUTURAL (validador) | idem |
| `type ContentFormat = "POST" \| "REELS" \| ...` | `frontend/src/lib/types.ts:197` | ESTRUTURAL (espelho) | idem |
| `FORMAT_LABEL = { POST:"Post", REELS:"Reels", STORY:"Story", CAROUSEL:"Carrossel", VIDEO:"Vídeo", IMAGE:"Imagem" }` | `frontend/src/lib/format.ts:33` | COSMÉTICO (rótulo) | Rótulos por template, ou "Tipo"/"Categoria" genérico |
| Seletor "Formato" | `NewContent.tsx:120` | COSMÉTICO | "Tipo" / "Categoria" (ou ocultar quando o nicho não usa) |
| `{FORMAT_LABEL[...]}` renderizado | `ContentsList.tsx:748,780,859`; `ContentDetail.tsx:224` | COSMÉTICO | segue o rótulo acima |

### 1b. Papéis — `UserRole` / `ROLE_LABEL`

| Termo atual | arquivo:linha | Natureza | Proposta neutra |
|---|---|---|---|
| `enum UserRole { ADMIN, CONTENT_MANAGER, EDITOR, SOCIAL_MEDIA, DESIGNER }` | `backend/prisma/schema.prisma:17` | ESTRUTURAL (enum DB) | Ver §2b |
| `ROLE_LABEL = { CONTENT_MANAGER:"Gerente de Conteúdo", EDITOR:"Editor", SOCIAL_MEDIA:"Social Media", DESIGNER:"Designer" }` | `frontend/src/lib/format.ts:40` | COSMÉTICO (rótulo) | Papéis neutros: "Gerente", "Responsável", "Atendente", "Operador" |
| `type UserRole = "ADMIN" \| "CONTENT_MANAGER" \| ...` | `frontend/src/lib/types.ts:198` | ESTRUTURAL (espelho) | idem §2b |

Nota: já existe uma camada de papéis **neutra e funcional** — `MEMBER_ROLE_LABEL`
(`OWNER/ADMIN/MEMBER`, `format.ts:46`). Os papéis editoriais (`UserRole`) são a
camada legada presa ao nicho.

### 1c. Status — `ContentStatus` / `STATUS_LABEL`

| Termo atual | arquivo:linha | Natureza | Proposta neutra |
|---|---|---|---|
| `STATUS_LABEL = { ...SCHEDULED:"Agendado", PUBLISHED:"Publicado" }` | `frontend/src/lib/format.ts:3` | COSMÉTICO (rótulo) | "Agendado" é neutro; **"Publicado"** é editorial → "Concluído" / "Entregue" |
| `enum ContentStatus { ...SCHEDULED, PUBLISHED }` | `backend/prisma/schema.prisma:55` | ESTRUTURAL | manter chave; só o rótulo muda (§2a) |

O restante do fluxo (`DRAFT/IN_REVIEW/AWAITING_CLIENT/CHANGES_REQUESTED/APPROVED`)
já é neutro — serve igual para orçamento de clínica ou pedido de comércio.

### 1d. Rótulos de tela dentro da Demanda

| Termo atual | arquivo:linha | Natureza | Proposta neutra |
|---|---|---|---|
| "Legenda" | `ContentDetail.tsx:367,787,792`; `NewContent.tsx:137` | COSMÉTICO | **"Descrição"** |
| "URL da mídia (opcional)" / "URL da mídia (demo)" | `ContentDetail.tsx:796`; `NewContent.tsx:147` | COSMÉTICO | **"Anexo / Link"** ou "Arquivo" |
| "Pré-visualização" | `ContentDetail.tsx:359` | COSMÉTICO | "Visualização" / "Prévia" (neutro, mantém) |
| "Publicação prevista" | `ContentDetail.tsx:309,416` | COSMÉTICO | **"Prazo"** / "Data prevista" |
| "Agendar publicação" | `ContentDetail.tsx:853` | COSMÉTICO | **"Agendar"** / "Definir prazo" |
| "Agendar conteúdo" (title) | `ContentsList.tsx:715` | COSMÉTICO | "Agendar" |
| "Marcar como publicado" | `ContentDetail.tsx:608` | COSMÉTICO | **"Marcar como concluído"** |
| "Criar nova versão" / "Nova versão" / "Salvar versão" / "Versão N" | `ContentDetail.tsx:415,569,785,823,902,224` | COSMÉTICO | "Revisão" / "Atualização" (ou manter "Versão" — é razoavelmente neutro) |
| "conteúdo" na copy ("aprovou o conteúdo", "reprovou o conteúdo", "faz parte de um agrupamento") | `ContentDetail.tsx:265,951,953,955` | COSMÉTICO | "demanda" / "item" |

---

## 2. Separação: rótulo (sem migração) vs. decisão de produto (migração)

### 2a. Troca só no rótulo — SEM migração (baixo risco)

Alteráveis editando apenas strings no frontend (as chaves do enum no DB ficam):

- `FORMAT_LABEL` (`format.ts:33`) e o seletor "Formato" (`NewContent.tsx:120`).
- `ROLE_LABEL` (`format.ts:40`).
- `STATUS_LABEL.PUBLISHED` "Publicado" → "Concluído" (`format.ts:9`).
- Todos os rótulos de §1d: "Legenda", "URL da mídia", "Publicação prevista",
  "Agendar publicação", "Marcar como publicado", copy com "conteúdo".

Risco: textos de teste podem fixar strings. Verificar `frontend/src/tests/format.test.tsx`
e `jobs.test.tsx` antes de trocar (não auditado em detalhe aqui).

### 2b. Exige decisão de produto / migração (alto risco)

- **`ContentFormat` como enum obrigatório** (`schema.prisma:46`, `Job.format @default(POST)`
  em `schema.prisma:387`, validador `validation.ts:32`, espelho `types.ts:197`).
  Clínica/serviço não têm "Reels/Story". Decisão: (i) manter enum e só esconder o
  campo por template, (ii) trocar por `String`/categoria livre, ou (iii) enum de
  valores neutros. Qualquer troca de valores do enum = **migração de dados**.
- **`UserRole` editorial** (`schema.prisma:17`, `types.ts:198`). Renomear os
  valores do enum é migração; a saída barata é só reusar `MEMBER_ROLE_LABEL` e
  tratar `UserRole` como legado.
- **Nomes de tabela/modelo:** modelo Prisma `Job` mapeado para tabela **`Content`**
  (`@@map("Content")`, `schema.prisma`), e `JobVersion` → **`ContentVersion`**.
  Já há inconsistência interna (código diz `Job`, tabela diz `Content`).
  Renomear a tabela = migração; **não recomendado agora** (puramente cosmético no
  banco, custo alto, zero impacto no usuário).
- **Colunas `caption` / `mediaUrl`** (`schema.prisma:432-433`, `JobVersion`).
  Presas à ideia de post+mídia. Renomear p/ `description`/`attachmentUrl` =
  migração. Decisão de produto: uma Demanda genérica precisa de mais de 1 anexo?
  Hoje é 1 `mediaUrl` por versão.
- **`publicationTarget`** (coluna, `schema.prisma:395`; usada no calendário,
  `calendarService.ts:41,51,81` com tipo projetado `"PUBLICATION_TARGET"`).
  Rótulo "Prazo" é cosmético; renomear a **coluna** e o literal de tipo do
  calendário é estrutural.

---

## 3. Recomendação de vocabulário-base multi-nicho (curta)

Adotar um léxico neutro, orientado a "trabalho a entregar", e deixar os termos
editoriais como rótulos opcionais por template:

| Conceito | Base neutra | (editorial = só um preset de rótulo) |
|---|---|---|
| A unidade de trabalho | **Demanda** (já em uso) | "Conteúdo" |
| Texto descritivo | **Descrição** | "Legenda" |
| Arquivo/link | **Anexo** | "Mídia" |
| Data-alvo | **Prazo** | "Publicação prevista" |
| Iteração | **Revisão** (ou manter "Versão") | — |
| Fim do fluxo | **Concluído** | "Publicado" |
| Tipo da demanda | **Tipo/Categoria** (ocultável) | formatos POST/REELS/… |
| Pessoas | **MEMBER_ROLE** (`Proprietário/Administrador/Membro`) | papéis editoriais |

Princípio: **rótulo primeiro, migração depois**. Quase todo o resíduo editorial
visível ao usuário é cosmético (§2a) e pode neutralizar já; mexer em enums,
colunas e nome de tabela (§2b) fica para uma decisão de produto específica, pois
custa migração e não muda o que o usuário vê.
