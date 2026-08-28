# Relatório de Auditoria de Segurança — Looply
Data: 28 de agosto de 2026 · looply@750d2df · 5 achados (0 crítica, 2 alta, 0 média, 2 baixa, 1 informativa)

## Escopo
- Backend: /srv/verbum/workspaces/looply/backend — 24 arquivos de rotas, 15 services, 5 middlewares, lib (app.ts, env.ts, session.ts, password.ts, rateLimit.ts, loginLimiter.ts, validation.ts)
- Frontend: /srv/verbum/workspaces/looply/frontend/src — componentes, features (inbox, contents, team, settings, media), lib/api.ts
- Deploy/ops: ecosystem.config.cjs (pm2), ops/ (backup, nginx, systemd, deploy), .env.example, .gitignore
- Histórico git (looply e verbumlab) e bundle de produção do frontend (apps/looply/frontend/assets)

## Stack
- **linguagem**: TypeScript (Node.js 24 / backend CommonJS; frontend ESM)
- **framework**: Express 4 (backend) · React 19 + Vite (frontend SPA)
- **orm**: Prisma 5 + PostgreSQL 16 (sem RLS — isolamento por filtro manual de companyId)
- **auth**: Sessão própria em cookie httpOnly (token aleatório 256-bit, sha256 em restingação), membership OWNER/ADMIN/MEMBER por empresa
- **frontend**: React 19 + react-router + Tailwind; comunicação via cookie de sessão (sem tokens no bundle)
- **deploy**: pm2 (ecosystem.config.cjs) + nginx proxy; sem Docker/Helm/Terraform no repositório

## Pontos fortes
- **Isolamento de tenant em 100% das rotas de listagem/agregação** — Toda rota derivava req.auth.companyId do middleware (middleware/requireAuth.ts:17) e todo service filtra por companyId: dashboardService.ts:27-56 (groupBy), clientService.ts:63,111,131,137,145, jobService.ts:120,179,199,219,233,250,276, contentService.ts:114-241, appointmentService.ts:115, activityService.ts:29, approvalService.ts:33,76,87,96,100, attachmentService.ts:43,75,89,95,107,115,119, conversationService.ts:341,360,439,588,611. Nenhum handler de listagem/busca/relatório sem filtro de tenant.
- **Zero IDOR nos handlers por-ID** — Todos os lookups por ID usam findFirst({ id, companyId }) antes de mutar (padrão verify-then-update). O endpoint por-chave /api/media/file valida prefixo do storageKey contra membership ativo (identityMediaService.ts:347-374). Arquivos de aprovação pública escopam por token+empresa+job (approvalService.ts:175-182).
- **Privilégio sempre revalidado no servidor** — requireRole(OWNER, ADMIN) em settings.ts:53,86 e workflows.ts:38,54,74,91; checagem de papel no service em memberService.ts:38 (só OWNER gerencia papéis), :210 (ADMIN não reseta OWNER/ADMIN), :72 (convite), whatsappActorService.ts:71, media.ts:36-41 (requireAdminOrOwner). O frontend nunca é a única barreira.
- **Webhooks fail-closed** — Meta: HMAC sha256 + timingSafeEqual com raw body (whatsappProvider.ts:100-111; rota whatsappWebhook.ts:76-86 — 503 se não configurado, 401 se assinatura inválida). Gupshup: allowlist de IP obrigatória, 503 sem configuração (whatsappGupshupWebhook.ts:52-63).
- **Segredos fora do repo do Looply** — .env no .gitignore e nunca commitado (git log --all vazio para .env); .env.example só com placeholders CHANGE_ME; scripts ops/ exigem variáveis com :?required (ops/backup/verify.sh:32-33); bundle do frontend sem chaves (scan por sk-/AIza/ghp_/xox-); nenhuma credencial hardcode nos últimos 200 commits (git grep em ts/tsx/md/json).
- **Sessão e recuperação de senha robustas** — Token de sessão hasheado (sha256) em banco (authService.ts:116); membership revalidado a cada request (:123-131); troca de senha revoga todas as sessões (auth.ts:107-118); recovery com token 256-bit hasheado, single-use, 1h de TTL, rate-limit e resposta que não vaza existência de conta (recoveryService.ts:27-67); rate-limit em login (10/15min), invitation-accept, password-reset e aprovações públicas (lib/rateLimit.ts).
- **Frontend sem sinks de XSS direto** — Nenhum dangerouslySetInnerHTML/eval/new Function no src (grep). Links de chat aceitam só http/https (formatMessageText.tsx:40-42,62); DocumentBubble restringe href a http/https//api (DocumentBubble.tsx:27-33); avatares/logos vão apenas para <img src> (esquemas javascript:/data: são inertes em img).

## Achados
### [ALTA] XSS armazenado via mediaUrl com scheme javascript:
- **Onde:** backend/src/lib/validation.ts:18,25 · frontend/src/features/ContentDetail.tsx:889
- **Código:**
```
// validation.ts:25 — z.string().url() aceita "javascript:alert(1)" (verificado empiricamente)
mediaUrl: z.string().url().max(2000).optional().or(z.literal("")).optional(),
// ContentDetail.tsx:889 — href recebe a URL sem restrição de esquema
<a href={v.mediaUrl} target="_blank" rel="noopener noreferrer">Ver mídia</a>
```
- **Por que é explorável:** Membro autenticado do workspace cria uma versão de conteúdo (POST /api/contents/:id/versions) com mediaUrl="javascript:payload". O validador zod .url() aceita qualquer esquema com dois-pontos (testado: javascript: e data: passam). Outro usuário da mesma equipe abre o conteúdo e clica em "Ver mídia" — o anchor executa o scheme javascript: no contexto da aplicação. Não há biblioteca de sanitização no projeto. Condições: atacante precisa ser membro convidado + vítima clica; reflete-se em roubo de cookie de sessão (httpOnly mitiga exfiltração direta, mas o script roda como a vítima na origem).

### [ALTA] Senha do admin de produção commitada no repositório verbumlab
- **Onde:** /srv/verbum/workspaces/verbumlab/scripts/capture-looply.ts:32
- **Código:**
```
await page.fill('input[type="password"]', 'REDACTED_LOOPLY_ADMIN_PASSWORD');
```
- **Por que é explorável:** É a SEED_ADMIN_PASSWORD real da instância pública https://looply.verbumlab.com.br — validada em execução: o login com essa senha retornou 200 e sessão ativa. Está commitada em dois commits do histórico do verbumlab (47b42b8 e 0816379). Qualquer leitor do repositório obtém acesso de administrador (persona OWNER) à instância de produção do Looply, incluindo dados de todos os workspaces de demonstração e rotas administrativas.

### [BAIXA] Nome do usuário sem escape no HTML do e-mail de recuperação
- **Onde:** backend/src/services/mailService.ts:79 (fonte do dado: routes/auth.ts:169-186)
- **Código:**
```
Olá, <strong style="color:#2A171F;">${input.name}</strong>!  // mailService.ts:79
// name é livre: updateProfileSchema aceita qualquer string de até 120 chars (auth.ts)
```
- **Por que é explorável:** PATCH /api/auth/me permite gravar name com marcação HTML. O template do e-mail de recuperação injeta ${input.name} sem escape. O e-mail só é enviado para o próprio endereço do usuário (self-injection), limitando o impacto a phishing/injeção visual no cliente de e-mail do próprio atacante — por isso baixa. Ainda é um sink real de HTML não sanitizado no backend.

### [BAIXA] validateEnv não rejeita valores placeholder/default de segredo
- **Onde:** backend/src/lib/env.ts:68-85
- **Código:**
```
if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
if (env.CORS_ORIGIN === "*") throw new Error("CORS_ORIGIN must not be wildcard");
// única validação: presença de DATABASE_URL e CORS não-curinga
```
- **Por que é explorável:** A validação de startup checa presença, não valor. SEED_ADMIN_PASSWORD="CHANGE_ME_SEED_ADMIN_PASSWORD" (o placeholder do .env.example) passa direto e vira a senha de admin se ninguém sobrescrever — exatamente o padrão "default público que vira segredo real". Os segredos de webhook (WHATSAPP_APP_SECRET etc.) falham fechado quando ausentes (bom), mas valores placeholder óbvios não são rejeitados em nenhum ponto.

### [INFORMATIVA] Gate de papel do frontend trata role ausente como privilegiado (fail-open na UI)
- **Onde:** frontend/src/features/Team.tsx:62-63 · frontend/src/features/EditCompanyModal.tsx:48
- **Código:**
```
const isOwner = currentRole === "OWNER" || !currentRole;            // Team.tsx:62
const isAdminOrOwner = currentRole === "OWNER" || currentRole === "ADMIN" || !currentRole; // :63
const isOwnerOrAdmin = activeRole === "OWNER" || activeRole === "ADMIN" || !activeRole;    // EditCompanyModal.tsx:48
```
- **Por que é explorável:** Com role indefinida (edge: membership ainda carregando), a UI exibe controles de OWNER/ADMIN. O servidor valida em toda rota sensível (requireRole + checagens de service — verificado handler por handler), então o pior caso é um 403; não há bypass real. Registrado como informativa/hardening de UX.

## Recomendações
P1 Rotacionar senha admin + purgar credencial do repo verbumlab (A2)
P2 Restringir esquema de URL (https only) em mediaUrl/logoUrl/avatarUrl + CSP (A1)
P3 Escape HTML do nome no e-mail de recuperação (A3)
P4 validateEnv rejeita placeholders de segredo em produção (A4)
P5 UI fail-closed quando role ausente (A5)
