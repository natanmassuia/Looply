<!-- HISTORICAL (2026-08-13, pre-F1). Superseded by the F1 semantic runtime + Figma 00-13 canonical frames. NOT a design authority. Standing contract: product frames are the UI source; Figma annotations are not runtime UI; static frames are not the full runtime behavior contract; motion is implemented/validated at runtime; Human Relay is the canonical Looply symbol; customer-facing copy stays client-friendly (Empresa, not workspace; no V1/provider/backend/capability language). See looply-fr1-retroactive-frontend-reconciliation-audit.md -->

# Looply — Funcionalidades Implementadas

**Data:** 2026-08-13
**Produto:** Looply — Gestão de Fluxo de Conteúdos
**URL:** https://looply.verbumlab.com.br

---

## 🎨 Design System

### Paleta Visual
- **Tema light intencional** — fundo `#f4f5f7` (cinza-azulado), não branco puro
- **Texto charcoal/navy** (`#1a1d26`) — mais suave que preto puro
- **Azul como accent** — usado apenas em ações primárias, não como cor dominante
- **Sistema de status com tons** — 10% bg + 20% border + 100% texto para cada cor semântica
- **Sombras quase invisíveis** — usadas seletivamente para elevação, não em tudo

### Tipografia
- **Hierarquia real** — título da página, subtítulo, seção, conteúdo, metadata visivelmente distintos
- **Labels uppercase apenas em metadata** — 11px, bold, tracking 0.05em
- **Inter com font features** — `cv11`, `ss01` para melhor legibilidade

### Componentes
- **Botões pill** (`border-radius: 9999px`) — hover, pressed (`scale 0.98`), focus ring
- **Cards com borda sutil** — sem sombras pesadas, sem "retângulos com borda"
- **Inputs com select customizado** — chevron SVG via data URI
- **Status pills** — dot colorido + label, consistente em todo o app

---

## 📊 Dashboard

### Composição
- **Saudação contextual** — "Bom dia, Natan" / "Boa tarde, Natan" / "Boa noite, Natan"
- **Painel de atenção** — mostra conteúdos pendentes com borda lateral colorida (âmbar). Quando vazio, status positivo sutil (não painel gigante vazio)
- **4 métricas compactas** — Em revisão, Aguardando cliente, Aprovados, Agendados (com ícones coloridos)
- **Layout assimétrico** — "Em andamento" (65%) + "Próximas publicações" (35%)
- **Linhas ricas** — ícone de formato, título, cliente, versão, status, tempo relativo
- **Removido** — 6 cards KPI iguais, quick links desnecessários, painéis vazios gigantes

---

## 📋 Kanban de Conteúdos

### Colunas (7 estágios do workflow)
| Coluna | Cor | Transição |
|--------|-----|-----------|
| Rascunho | Cinza | → Em revisão |
| Em revisão | Âmbar | → Aguardando cliente |
| Aguardando cliente | Violeta | → Alterações / Aprovado |
| Alterações solicitadas | Rosa | → Em revisão |
| Aprovado | Verde | → Agendado |
| Agendado | Azul | → Publicado |
| Publicado | Teal | Terminal |

### Funcionalidades
- **Drag-and-drop nativo** — HTML5, sem bibliotecas externas
- **Movimento livre** — qualquer card pode ir para qualquer coluna (validação no backend)
- **Clique simples** → abre detalhe do conteúdo
- **Clique + arrasta** → move entre colunas
- **Colunas com altura total** — scroll interno quando há muitos cards
- **Drop zone visual** — coluna destaca com borda azul + fundo brand ao arrastar
- **Cards com cursor grab** — indicam que são arrastáveis
- **Grid de 7 colunas** — ocupa toda a largura disponível
- **Contador por coluna** — badge com número de itens

---

## 📅 Calendário

### Funcionalidades
- **Navegação por mês** — setas `‹` `›` nos lados, mês/ano centralizado
- **Grid semanal** — Dom a Sáb, células com altura mínima de 90px
- **Chips coloridos** — cor da marca do cliente, truncados com tooltip
- **Indicador de hoje** — círculo azul no dia atual
- **Overflow indicator** — "+N mais" quando há mais de 3 itens no dia
- **Legenda explicativa** — explica o que é cada cor/elemento
- **Células de outros meses** — fundo sutil diferenciado

---

## 👥 Equipe (CRUD Completo)

### Backend
- **`POST /api/team`** — endpoint com validação Zod (nome, email, role)
- **`GET /api/team`** — lista todos os membros

### Frontend
- **Botão "Novo membro"** no header
- **Formulário inline** — nome, email, função (dropdown com 5 papéis)
- **Cards de membro** — avatar com iniciais, nome, email, badge de função, status ativo/inativo
- **Cores por função** — Admin (azul), Gerente (violeta), Editor (âmbar), Social Media (azul), Designer (rosa)

---

## 🏢 Clientes

### Funcionalidades
- **CRUD completo** — criar, listar clientes
- **Cards visuais** — avatar com iniciais + cor da marca, nome, contato, status
- **Métricas por cliente** — conteúdos ativos, canais, email
- **Formulário inline** — nome, cor da marca, contato, email, telefone, canais
- **Status visual** — Ativo (verde), Inativo (cinza), Prospect (âmbar)

---

## 📝 Conteúdo — Criação e Detalhe

### Novo Conteúdo
- **Layout 2 colunas** — informações principais (60%) + detalhes/ações (40%)
- **Formulário único** — corrigido bug de dois forms separados
- **CTA proeminente** — botão primário grande na coluna lateral
- **Campos agrupados** — título, cliente, formato, legenda, mídia, canal, responsável, data

### Detalhe do Conteúdo
- **Preview primeiro** — mídia como âncora visual
- **Metadata em grid** — cliente, formato, canal, responsável, versão, data prevista
- **Barra lateral de ações** — workflow contextual por status
- **Histórico de versões** — timeline com aprovação/alterações
- **Link de aprovação** — copiar/abrir link público

---

## 🔗 Aprovação Pública

### Funcionalidades
- **Tela premium** — client-facing, sem sidebar
- **Header com cor da marca** — identidade do cliente
- **Preview de mídia** — destaque visual
- **Legenda** — texto formatado
- **Ações claras** — Aprovar (verde) / Solicitar alteração (outline)
- **Modo de feedback** — textarea + submit
- **Resultado visual** — caixas coloridas para aprovado/alteração/erro
- **Mobile-first** — otimizado para 390x844

---

## 🧭 Navegação (Sidebar)

### Funcionalidades
- **Retrátil** — toggle no rodinho, colapsa para 72px (só ícones)
- **Marca Looply** — ícone em camadas + nome + subtítulo
- **5 itens de navegação** — Dashboard, Conteúdos, Calendário, Clientes, Equipe
- **Estado ativo** — fundo azul sutil + texto azul
- **Área do usuário** — avatar com iniciais, nome, função
- **Tooltips** — quando colapsada, mostra nome no hover

---

## 🛠️ Infraestrutura

### Backend
- **Express + Prisma** — API RESTful
- **Workflow validado** — transições de status explícitas (`domain/workflow.ts`)
- **Versionamento** — versões monotônicas de conteúdo
- **Aprovação pública** — tokens criptográficos, não IDs numéricos
- **Seed completo** — dados demo em todos os statuses do workflow

### Frontend
- **React 19 + Vite 6** — build rápido
- **Tailwind 3.4** — design tokens customizados
- **TanStack Query 5** — cache e sincronização de dados
- **Zustand 5** — estado UI minimal (sidebar colapsada)
- **Zero dependências de UI** — sem Radix, shadcn, Headless UI

### Deploy
- **Nginx** — reverse proxy + SSL (Let's Encrypt)
- **PM2** — gerenciamento de processo backend
- **Build otimizado** — CSS 32KB, JS 326KB (gzipped)

---

## ✅ Validação

| Check | Status |
|-------|--------|
| Prisma schema | ✅ Válido |
| TypeCheck frontend | ✅ 0 erros |
| TypeCheck backend | ✅ 0 erros |
| Testes frontend | ✅ 5/5 |
| Testes backend | ✅ 20/20 |
| Build | ✅ Sucesso |
| Health endpoint | ✅ 200 OK |
| Produção | ✅ https://looply.verbumlab.com.br |

---

## 📁 Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `frontend/src/index.css` | Design system completo (cores, botões, inputs, cards) |
| `frontend/tailwind.config.js` | Tokens customizados (cores, sombras, radii) |
| `frontend/src/components/Icons.tsx` | 27 ícones SVG hand-coded |
| `frontend/src/components/common.tsx` | PageHeader, Card, EmptyState, MediaPreview, Spinner |
| `frontend/src/components/Sidebar.tsx` | Sidebar retrátil com toggle |
| `frontend/src/components/AppLayout.tsx` | Layout full-width |
| `frontend/src/components/StatusPill.tsx` | Badge de status com dot colorido |
| `frontend/src/features/Dashboard.tsx` | Dashboard redesign completo |
| `frontend/src/features/ContentsList.tsx` | Kanban board com drag-and-drop |
| `frontend/src/features/NewContent.tsx` | Layout 2 colunas, form único |
| `frontend/src/features/ContentDetail.tsx` | Preview-first, workflow actions |
| `frontend/src/features/PublicApproval.tsx` | Tela premium client-facing |
| `frontend/src/features/Calendar.tsx` | Calendário com navegação e legenda |
| `frontend/src/features/Clients.tsx` | CRUD de clientes |
| `frontend/src/features/Team.tsx` | CRUD de equipe |
| `backend/src/routes/team.ts` | POST /api/team com validação Zod |
| `backend/src/services/teamService.ts` | createTeamMember |
| `backend/src/routes/contents.ts` | PATCH /:id/status (movimento livre) |
