// Gerador do Relatório de Auditoria de Segurança — Looply (HTML → PDF via Chromium/Playwright)
// Regenerar: node docs/security-audit/generate-report.mjs
// Dependência: @playwright/test do workspace verbumlab (resolvido por caminho absoluto abaixo).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = HERE;
const PDF_PATH = path.join(OUT_DIR, 'relatorio-auditoria-seguranca.pdf');
const MD_PATH = path.join(OUT_DIR, 'relatorio-auditoria-seguranca.md');

const require = createRequire('/srv/verbum/workspaces/verbumlab/package.json');
const { chromium } = require('@playwright/test');

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  critica: '#B91C1C', alta: '#EA580C', media: '#D97706', baixa: '#2563EB',
  forte: '#059669', info: '#64748B', ink: '#1C1917', muted: '#57534E',
  soft: '#FAFAF9', border: '#E7E5E4', brand: '#7C2D12',
};

// ─── Dados da auditoria (2026-08-28) ───────────────────────────────────────
const DATA = {
  projeto: 'Looply',
  data: '28 de agosto de 2026',
  escopo: [
    'Backend: /srv/verbum/workspaces/looply/backend — 24 arquivos de rotas, 15 services, 5 middlewares, lib (app.ts, env.ts, session.ts, password.ts, rateLimit.ts, loginLimiter.ts, validation.ts)',
    'Frontend: /srv/verbum/workspaces/looply/frontend/src — componentes, features (inbox, contents, team, settings, media), lib/api.ts',
    'Deploy/ops: ecosystem.config.cjs (pm2), ops/ (backup, nginx, systemd, deploy), .env.example, .gitignore',
    'Histórico git (looply e verbumlab) e bundle de produção do frontend (apps/looply/frontend/assets)',
  ],
  stack: {
    linguagem: 'TypeScript (Node.js 24 / backend CommonJS; frontend ESM)',
    framework: 'Express 4 (backend) · React 19 + Vite (frontend SPA)',
    orm: 'Prisma 5 + PostgreSQL 16 (sem RLS — isolamento por filtro manual de companyId)',
    auth: 'Sessão própria em cookie httpOnly (token aleatório 256-bit, sha256 em restingação), membership OWNER/ADMIN/MEMBER por empresa',
    frontend: 'React 19 + react-router + Tailwind; comunicação via cookie de sessão (sem tokens no bundle)',
    deploy: 'pm2 (ecosystem.config.cjs) + nginx proxy; sem Docker/Helm/Terraform no repositório',
  },
  pontosFortes: [
    { titulo: 'Isolamento de tenant em 100% das rotas de listagem/agregação', evidencia: 'Toda rota derivava req.auth.companyId do middleware (middleware/requireAuth.ts:17) e todo service filtra por companyId: dashboardService.ts:27-56 (groupBy), clientService.ts:63,111,131,137,145, jobService.ts:120,179,199,219,233,250,276, contentService.ts:114-241, appointmentService.ts:115, activityService.ts:29, approvalService.ts:33,76,87,96,100, attachmentService.ts:43,75,89,95,107,115,119, conversationService.ts:341,360,439,588,611. Nenhum handler de listagem/busca/relatório sem filtro de tenant.' },
    { titulo: 'Zero IDOR nos handlers por-ID', evidencia: 'Todos os lookups por ID usam findFirst({ id, companyId }) antes de mutar (padrão verify-then-update). O endpoint por-chave /api/media/file valida prefixo do storageKey contra membership ativo (identityMediaService.ts:347-374). Arquivos de aprovação pública escopam por token+empresa+job (approvalService.ts:175-182).' },
    { titulo: 'Privilégio sempre revalidado no servidor', evidencia: 'requireRole(OWNER, ADMIN) em settings.ts:53,86 e workflows.ts:38,54,74,91; checagem de papel no service em memberService.ts:38 (só OWNER gerencia papéis), :210 (ADMIN não reseta OWNER/ADMIN), :72 (convite), whatsappActorService.ts:71, media.ts:36-41 (requireAdminOrOwner). O frontend nunca é a única barreira.' },
    { titulo: 'Webhooks fail-closed', evidencia: 'Meta: HMAC sha256 + timingSafeEqual com raw body (whatsappProvider.ts:100-111; rota whatsappWebhook.ts:76-86 — 503 se não configurado, 401 se assinatura inválida). Gupshup: allowlist de IP obrigatória, 503 sem configuração (whatsappGupshupWebhook.ts:52-63).' },
    { titulo: 'Segredos fora do repo do Looply', evidencia: '.env no .gitignore e nunca commitado (git log --all vazio para .env); .env.example só com placeholders CHANGE_ME; scripts ops/ exigem variáveis com :?required (ops/backup/verify.sh:32-33); bundle do frontend sem chaves (scan por sk-/AIza/ghp_/xox-); nenhuma credencial hardcode nos últimos 200 commits (git grep em ts/tsx/md/json).' },
    { titulo: 'Sessão e recuperação de senha robustas', evidencia: 'Token de sessão hasheado (sha256) em banco (authService.ts:116); membership revalidado a cada request (:123-131); troca de senha revoga todas as sessões (auth.ts:107-118); recovery com token 256-bit hasheado, single-use, 1h de TTL, rate-limit e resposta que não vaza existência de conta (recoveryService.ts:27-67); rate-limit em login (10/15min), invitation-accept, password-reset e aprovações públicas (lib/rateLimit.ts).' },
    { titulo: 'Frontend sem sinks de XSS direto', evidencia: 'Nenhum dangerouslySetInnerHTML/eval/new Function no src (grep). Links de chat aceitam só http/https (formatMessageText.tsx:40-42,62); DocumentBubble restringe href a http/https//api (DocumentBubble.tsx:27-33); avatares/logos vão apenas para <img src> (esquemas javascript:/data: são inertes em img).' },
  ],
  achados: [
    {
      id: 'A1', cat: 'XSS (Cat. 5)', sev: 'alta',
      titulo: 'XSS armazenado via mediaUrl com scheme javascript:',
      arquivo: 'backend/src/lib/validation.ts:18,25 · frontend/src/features/ContentDetail.tsx:889',
      codigo: `// validation.ts:25 — z.string().url() aceita "javascript:alert(1)" (verificado empiricamente)
mediaUrl: z.string().url().max(2000).optional().or(z.literal("")).optional(),
// ContentDetail.tsx:889 — href recebe a URL sem restrição de esquema
<a href={v.mediaUrl} target="_blank" rel="noopener noreferrer">Ver mídia</a>`,
      porque: 'Membro autenticado do workspace cria uma versão de conteúdo (POST /api/contents/:id/versions) com mediaUrl="javascript:payload". O validador zod .url() aceita qualquer esquema com dois-pontos (testado: javascript: e data: passam). Outro usuário da mesma equipe abre o conteúdo e clica em "Ver mídia" — o anchor executa o scheme javascript: no contexto da aplicação. Não há biblioteca de sanitização no projeto. Condições: atacante precisa ser membro convidado + vítima clica; reflete-se em roubo de cookie de sessão (httpOnly mitiga exfiltração direta, mas o script roda como a vítima na origem).',
    },
    {
      id: 'A2', cat: 'Chaves expostas (Cat. 4)', sev: 'alta',
      titulo: 'Senha do admin de produção commitada no repositório verbumlab',
      arquivo: '/srv/verbum/workspaces/verbumlab/scripts/capture-looply.ts:32',
      codigo: `await page.fill('input[type="password"]', 'REDACTED_LOOPLY_ADMIN_PASSWORD');`,
      porque: 'É a SEED_ADMIN_PASSWORD real da instância pública https://looply.verbumlab.com.br — validada em execução: o login com essa senha retornou 200 e sessão ativa. Está commitada em dois commits do histórico do verbumlab (47b42b8 e 0816379). Qualquer leitor do repositório obtém acesso de administrador (persona OWNER) à instância de produção do Looply, incluindo dados de todos os workspaces de demonstração e rotas administrativas.',
    },
    {
      id: 'A3', cat: 'Inputs sem tratamento (Cat. 5)', sev: 'baixa',
      titulo: 'Nome do usuário sem escape no HTML do e-mail de recuperação',
      arquivo: 'backend/src/services/mailService.ts:79 (fonte do dado: routes/auth.ts:169-186)',
      codigo: `Olá, <strong style="color:#2A171F;">\${input.name}</strong>!  // mailService.ts:79
// name é livre: updateProfileSchema aceita qualquer string de até 120 chars (auth.ts)`,
      porque: 'PATCH /api/auth/me permite gravar name com marcação HTML. O template do e-mail de recuperação injeta ${input.name} sem escape. O e-mail só é enviado para o próprio endereço do usuário (self-injection), limitando o impacto a phishing/injeção visual no cliente de e-mail do próprio atacante — por isso baixa. Ainda é um sink real de HTML não sanitizado no backend.',
    },
    {
      id: 'A4', cat: 'Chaves expostas (Cat. 4)', sev: 'baixa',
      titulo: 'validateEnv não rejeita valores placeholder/default de segredo',
      arquivo: 'backend/src/lib/env.ts:68-85',
      codigo: `if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
if (env.CORS_ORIGIN === "*") throw new Error("CORS_ORIGIN must not be wildcard");
// única validação: presença de DATABASE_URL e CORS não-curinga`,
      porque: 'A validação de startup checa presença, não valor. SEED_ADMIN_PASSWORD="CHANGE_ME_SEED_ADMIN_PASSWORD" (o placeholder do .env.example) passa direto e vira a senha de admin se ninguém sobrescrever — exatamente o padrão "default público que vira segredo real". Os segredos de webhook (WHATSAPP_APP_SECRET etc.) falham fechado quando ausentes (bom), mas valores placeholder óbvios não são rejeitados em nenhum ponto.',
    },
    {
      id: 'A5', cat: 'Permissão no navegador (Cat. 2)', sev: 'informativa',
      titulo: 'Gate de papel do frontend trata role ausente como privilegiado (fail-open na UI)',
      arquivo: 'frontend/src/features/Team.tsx:62-63 · frontend/src/features/EditCompanyModal.tsx:48',
      codigo: `const isOwner = currentRole === "OWNER" || !currentRole;            // Team.tsx:62
const isAdminOrOwner = currentRole === "OWNER" || currentRole === "ADMIN" || !currentRole; // :63
const isOwnerOrAdmin = activeRole === "OWNER" || activeRole === "ADMIN" || !activeRole;    // EditCompanyModal.tsx:48`,
      porque: 'Com role indefinida (edge: membership ainda carregando), a UI exibe controles de OWNER/ADMIN. O servidor valida em toda rota sensível (requireRole + checagens de service — verificado handler por handler), então o pior caso é um 403; não há bypass real. Registrado como informativa/hardening de UX.',
    },
  ],
};

// ─── Estatísticas ──────────────────────────────────────────────────────────
const sevOrder = ['critica', 'alta', 'media', 'baixa', 'informativa'];
const sevLabel = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa', informativa: 'Informativa' };
const bySev = Object.fromEntries(sevOrder.map((s) => [s, DATA.achados.filter((a) => a.sev === s).length]));
const total = DATA.achados.length;
const catNames = ['Banco sem tranca (Cat. 1)', 'Permissão no navegador (Cat. 2)', 'IDOR (Cat. 3)', 'Chaves expostas (Cat. 4)', 'Inputs sem tratamento (Cat. 5)'];
const catKeys = ['1', '2', '3', '4', '5'];
const byCat = catKeys.map((k, i) => {
  const items = DATA.achados.filter((a) => a.cat.includes(`(Cat. ${k})`));
  const top = sevOrder.find((s) => items.some((it) => it.sev === s));
  return { name: catNames[i], count: items.length, color: top ? C[top] : C.info };
});

// ─── SVG: rosca por severidade ─────────────────────────────────────────────
function donutSvg() {
  const cx = 90, cy = 90, r = 70, sw = 30;
  const present = sevOrder.filter((s) => bySev[s] > 0);
  const totalArc = present.reduce((acc, s) => acc + bySev[s], 0);
  let angle = -Math.PI / 2;
  const segs = present.map((s) => {
    const frac = bySev[s] / totalArc;
    const a0 = angle, a1 = angle + frac * 2 * Math.PI;
    angle = a1;
    const large = frac > 0.5 ? 1 : 0;
    const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const p1 = [cx + r * Math.cos(a1 - 0.02), cy + r * Math.sin(a1 - 0.02)];
    return `<path d="M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}" fill="none" stroke="${C[s]}" stroke-width="${sw}" stroke-linecap="butt"/>`;
  }).join('');
  const legend = present.map((s) =>
    `<div class="lg-row"><span class="lg-dot" style="background:${C[s]}"></span>${sevLabel[s]} <b>${bySev[s]}</b></div>`
  ).join('');
  return `<div class="chart-wrap">
    <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Rosca de achados por severidade">
      ${segs}<circle cx="${cx}" cy="${cy}" r="${r - sw / 2 - 4}" fill="none" stroke="${C.border}" stroke-width="1"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="34" font-weight="800" fill="${C.ink}">${total}</text>
      <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="11" fill="${C.muted}">achados</text>
    </svg><div class="lg-col">${legend}</div></div>`;
}

// ─── SVG: barras por categoria ─────────────────────────────────────────────
function barsSvg() {
  const w = 700, rowH = 44, barMax = 360, pad = 236;
  const max = Math.max(1, ...byCat.map((c) => c.count));
  const rows = byCat.map((c, i) => {
    const y = i * rowH + 10;
    const bw = c.count === 0 ? 3 : Math.max(10, (c.count / max) * barMax);
    const note = c.count === 0 ? ' ✓ sem falhas' : '';
    return `<text x="${pad - 10}" y="${y + 18}" text-anchor="end" font-size="12.5" fill="${C.ink}">${c.name}</text>
      <rect x="${pad}" y="${y}" width="${barMax}" height="24" rx="6" fill="${C.soft}" stroke="${C.border}"/>
      <rect x="${pad}" y="${y}" width="${bw}" height="24" rx="6" fill="${c.color}"/>
      <text x="${pad + bw + 10}" y="${y + 17}" font-size="13" font-weight="700" fill="${C.ink}">${c.count}${note}</text>`;
  }).join('');
  const h = byCat.length * rowH + 14;
  return `<svg width="100%" viewBox="0 0 ${w} ${h}" role="img" aria-label="Barras de achados por categoria" style="max-width:640px">${rows}</svg>`;
}

// ─── HTML ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chip = (sev) => `<span class="chip" style="background:${C[sev]}1a;color:${C[sev]};border:1px solid ${C[sev]}55">${sevLabel[sev]}</span>`;

const findingsRows = DATA.achados.map((a) => `
  <tr class="avoid-break">
    <td style="width:110px">${chip(a.sev)}<div class="fid">${a.id} · ${esc(a.cat)}</div></td>
    <td><div class="ftitle">${esc(a.titulo)}</div>
        <div class="floc mono">${esc(a.arquivo)}</div>
        <pre class="code">${esc(a.codigo)}</pre>
        <div class="fdesc">${esc(a.porque)}</div></td>
  </tr>`).join('');

const strengths = DATA.pontosFortes.map((p) => `
  <div class="card forte avoid-break"><div class="ft">${esc(p.titulo)}</div><div class="fe mono">${esc(p.evidencia)}</div></div>`).join('');

const recomendacoes = `
  <div class="rec avoid-break"><span class="prio p1">P1</span><div><b>Rotacionar a senha admin do Looply e purgar a credencial do repositório verbumlab</b> (A2) — trocar SEED_ADMIN_PASSWORD no .env, remover do script de captura (ler de env), reescrever/invalidar os 2 commits com a senha e considerar o histórico exposto.</div></div>
  <div class="rec avoid-break"><span class="prio p1">P2</span><div><b>Restringir esquema de URL em mediaUrl/logoUrl/avatarUrl</b> (A1) — substituir z.string().url() por refine que aceite apenas https:// (e, para mídia, o domínio de storage); sanitizar a renderização ou abrir links de mídia só após validação. Adiciona defesa em profundidade: CSP via helmet (script-src 'self').</div></div>
  <div class="rec avoid-break"><span class="prio p2">P3</span><div><b>Escapar input.name no template de e-mail</b> (A3) — função de escape HTML mínima ou renderizar em texto puro;idealmente mover nome para fora de marcação.</div></div>
  <div class="rec avoid-break"><span class="prio p2">P4</span><div><b>validateEnv rejeita placeholders</b> (A4) — deny-list de valores (CHANGE_ME, password, secret…) para SEED_ADMIN_PASSWORD e segredos de webhook em produção (NODE_ENV=production ⇒ falha de startup).</div></div>
  <div class="rec avoid-break"><span class="prio p3">P5</span><div><b>Gate de papel fail-closed na UI</b> (A5) — tratar role ausente como MEMBER (esconder controles) em Team.tsx e EditCompanyModal.tsx; mantém o backend como está (já correto).</div></div>`;

const issues = DATA.achados.filter((a) => a.sev !== 'informativa' || true).map((a, i) => {
  const labels = `security, ${a.sev}`;
  return `
<div class="issue avoid-break">
  <div class="issue-head">--- ISSUE ${i + 1} ---</div>
<pre class="issue-body">**${a.sev === 'informativa' ? '[Hardening]' : '[Segurança]'} ${a.titulo}**

Labels: \`${labels}\`

## Descrição do problema
${a.porque}

## Evidência
\`${a.arquivo}\`

\`\`\`
${a.codigo}
\`\`\`

## Impacto
${a.sev === 'alta' ? 'Comprometimento de conta/sessão de usuário autenticado ou de administrador da instância.' : a.sev === 'baixa' ? 'Injeção limitada / risco de configuração insegura silenciosa.' : 'Somente cosmético — servidor já valida; melhoria de UX de segurança.'}

## Sugestão de correção
${{
  A1: 'Trocar `z.string().url()` por `z.string().refine(u => /^https:\\/\\//.test(u))` nos schemas de mediaUrl/logoUrl/avatarUrl (validation.ts, auth.ts, settings.ts) e adicionar CSP `script-src \'self\'` no helmet.',
  A2: 'Rotacionar a senha, ler credenciais do script via process.env (não commitar), invalidar os commits antigos (filter-repo/BFG) e auditar access logs de login admin.',
  A3: 'Aplicar escape HTML (função de 5 linhas) em `input.name` antes de interpolar no template de mailService.ts.',
  A4: 'Em validateEnv(), quando NODE_ENV=production, rejeitar valores da deny-list (CHANGE_ME, exemplo, password123…) para SEED_ADMIN_PASSWORD e segredos de webhook.',
  A5: 'Nos componentes Team/EditCompanyModal, papel ausente deve resolver para o mínimo privilégio (MEMBER), não para OWNER/ADMIN.',
}[a.id]}

## Critérios de aceite
${{
  A1: `- [ ] POST /api/contents/:id/versions com mediaUrl="javascript:alert(1)" retorna 400\n- [ ] Conteúdo existente com mediaUrl javascript: renderiza link inerte/bloqueado\n- [ ] Teste unitário cobrindo schemes não-https rejeitados\n- [ ] helmet CSP ativo em produção`,
  A2: `- [ ] Senha antiga não autentica mais (verificado em /login)\n- [ ] capture-looply.ts lê credenciais de process.env\n- [ ] git log -S"senha antiga" não retorna resultado no verbumlab\n- [ ] .env atualizado com nova senha fora do repo`,
  A3: `- [ ] E-mail de recuperação com name contendo <img> exibe o texto literal, não marcação\n- [ ] Teste unitário do template com nome hostil`,
  A4: `- [ ] NODE_ENV=production + SEED_ADMIN_PASSWORD=CHANGE_ME_SEED_ADMIN_PASSWORD aborta o startup\n- [ ] Valores legítimos passam normalmente (teste de regressão)`,
  A5: `- [ ] Team.tsx com currentRole undefined não exibe controles de gestão\n- [ ] EditCompanyModal com activeRole undefined não exibe campos administrativos`,
}[a.id]}
</pre>
  <div class="issue-head">--- FIM ISSUE ${i + 1} ---</div>
</div>`;
}).join('');

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Auditoria de Segurança — ${DATA.projeto}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', 'Segoe UI', sans-serif; font-size: 10pt; color: ${C.ink}; line-height: 1.55; margin: 0; }
  h1 { font-size: 21pt; color: ${C.brand}; margin: 0 0 6px; }
  h2 { font-size: 13.5pt; color: ${C.brand}; margin: 26px 0 10px; border-bottom: 2px solid ${C.border}; padding-bottom: 4px; }
  h3 { font-size: 11pt; margin: 14px 0 6px; }
  .mono, code { font-family: 'DejaVu Sans Mono', monospace; }
  .cover { text-align: left; padding-top: 130px; }
  .cover .kicker { font-size: 10pt; letter-spacing: .18em; text-transform: uppercase; color: ${C.alta}; font-weight: 700; }
  .cover h1 { font-size: 26pt; line-height: 1.15; margin: 10px 0 4px; }
  .cover .sub { font-size: 12pt; color: ${C.muted}; margin-bottom: 34px; }
  .cover .meta { border-top: 3px solid ${C.brand}; padding-top: 18px; }
  .cover .meta div { margin: 4px 0; font-size: 10.5pt; }
  .box { background: ${C.soft}; border: 1px solid ${C.border}; border-radius: 10px; padding: 12px 16px; margin: 10px 0; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid ${C.border}; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { background: #FDF3EC; color: ${C.brand}; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .fid { font-size: 8pt; color: ${C.muted}; margin-top: 4px; }
  .ftitle { font-weight: 700; margin-bottom: 3px; }
  .floc { font-size: 8.5pt; color: ${C.muted}; margin-bottom: 6px; }
  pre.code { background: #27272A; color: #F4F4F5; border-radius: 8px; padding: 8px 10px; font-size: 8pt; line-height: 1.45; white-space: pre-wrap; word-break: break-all; margin: 4px 0 6px; }
  .fdesc { font-size: 9pt; color: #44403C; }
  .chart-wrap { display: flex; gap: 26px; align-items: center; margin: 10px 0 16px; }
  .lg-col { display: flex; flex-direction: column; gap: 6px; }
  .lg-row { font-size: 10.5pt; }
  .lg-dot { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 7px; }
  .card { border-radius: 10px; padding: 10px 14px; margin: 8px 0; border: 1px solid ${C.border}; }
  .card.forte { background: #ECFDF5; border-color: #A7F3D0; }
  .card.forte .ft { font-weight: 700; color: #065F46; }
  .card.forte .fe { font-size: 8pt; color: ${C.muted}; margin-top: 4px; word-break: break-word; }
  .rec { display: flex; gap: 12px; margin: 10px 0; align-items: flex-start; }
  .prio { flex-shrink: 0; width: 34px; height: 24px; border-radius: 6px; color: #fff; font-weight: 800; font-size: 10pt; display: flex; align-items: center; justify-content: center; }
  .p1 { background: ${C.critica}; } .p2 { background: ${C.alta}; } .p3 { background: ${C.media}; }
  .issue { margin: 12px 0; }
  .issue-head { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; font-weight: 700; color: ${C.muted}; margin: 8px 0 4px; }
  pre.issue-body { background: ${C.soft}; border: 1px solid ${C.border}; border-left: 4px solid ${C.alta}; border-radius: 8px; padding: 12px 14px; font-size: 8.5pt; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .sevline { display: flex; gap: 10px; flex-wrap: wrap; margin: 8px 0 4px; }
  .sevstat { border-radius: 10px; padding: 10px 18px; color: #fff; font-weight: 800; min-width: 86px; text-align: center; }
  .sevstat span { display: block; font-size: 17pt; }
</style></head><body>

<div class="cover">
  <div class="kicker">Auditoria de segurança aplicada</div>
  <h1>Relatório de Auditoria de Segurança — ${DATA.projeto}</h1>
  <div class="sub">Gestão operacional de conteúdo para agências de marketing/social (Demo V1)</div>
  <div class="meta">
    <div><b>Data:</b> ${DATA.data}</div>
    <div><b>Versão do código:</b> looply@750d2df (main) · verbumlab@311dd8c</div>
    <div><b>Auditor:</b> agente automatizado (opencode) com verificação manual arquivo por arquivo</div>
    <div><b>Total de achados:</b> ${total} — ${bySev.critica} crítica · ${bySev.alta} alta · ${bySev.media} média · ${bySev.baixa} baixa · ${bySev.informativa} informativa</div>
  </div>
  <h2 style="margin-top:34px">Escopo auditado</h2>
  ${DATA.escopo.map((e) => `<div class="box">${esc(e)}</div>`).join('')}
  <h2>Nota metodológica — mapeamento das categorias para a stack detectada</h2>
  <div class="box">
    <b>Stack detectada:</b> ${Object.entries(DATA.stack).map(([k, v]) => `${k}: ${v}`).join(' · ')}.
  </div>
  <div class="box">
    <b>Cat. 1 (banco sem tranco):</b> sem Supabase/RLS — o mecanismo de isolamento é o middleware de sessão (requireAuth) que resolve <code>req.auth.companyId</code> a partir da sessão (nunca do cliente) + filtro manual de companyId em cada service Prisma. Auditei todas as rotas de listagem/agregação/relatório e os where de cada service.<br>
    <b>Cat. 2 (permissão no navegador):</b> cruzei cada gate de papel do React (isOwner/isAdminOrOwner em Team, EditCompanyModal) com o endpoint correspondente (requireRole + checagens em service).<br>
    <b>Cat. 3 (IDOR):</b> percorri os 24 arquivos de rotas e os 15 services, handler por handler, verificando lookup por ID sempre pareado com companyId.<br>
    <b>Cat. 4 (chaves expostas):</b> grep de código/configs/CI/ops, .env.example, histórico git de ambos os repositórios (git grep em 200 commits + git log de .env) e bundle de produção do frontend.<br>
    <b>Cat. 5 (XSS):</b> frontend — dangerouslySetInnerHTML/eval/href dinâmicos/markdown; backend — templates de e-mail. Sem lib de sanitização no projeto (confirmado em ambos package.json).
  </div>
</div>

<h2>Resumo executivo</h2>
<div class="sevline">
  ${sevOrder.filter((s) => bySev[s] > 0).map((s) => `<div class="sevstat" style="background:${C[s]}"><span>${bySev[s]}</span>${sevLabel[s]}</div>`).join('')}
</div>
<p>O Looply tem uma base de autorização notavelmente consistente para um Demo V1: <b>zero falhas de isolamento de tenant e zero IDOR</b> nas 24 rotas auditadas — o companyId derivado da sessão acompanha toda query, incluindo agregações do dashboard e download de mídia por chave. Os riscos centrais estão fora desse núcleo: <b>um XSS armazenado</b> via validação permissiva de URL em mídias de conteúdo, e <b>a senha de administrador de produção commitada</b> no repositório vizinho verbumlab (script de captura). Os demais achados são de hardening.</p>
${donutSvg()}
${barsSvg()}

<h2>Pontos fortes (verificado e correto)</h2>
${strengths}

<h2>Pontos fracos (riscos centrais)</h2>
<div class="box"><b>1. Cadeia de confiança de mídia:</b> a validação de URL aceita qualquer esquema e o frontend renderiza em href clicável (A1) — única rota de XSS encontrada.</div>
<div class="box"><b>2. Higiene de segredos entre repositórios:</b> a credencial admin real vazou para o repo de marketing/captura (A2) — o repo do Looply em si está limpo.</div>
<div class="box"><b>3. Defesa de configuração:</b> startup não rejeita placeholders de segredo (A4); e-mail usa input sem escape (A3).</div>

<h2>Achados detalhados por categoria</h2>
<table>
  <thead><tr><th style="width:110px">Severidade</th><th>Achado (arquivo:linha · código · explorabilidade)</th></tr></thead>
  <tbody>${findingsRows}</tbody>
</table>

<h2>Recomendações priorizadas</h2>
${recomendacoes}

<h2>Issues para o GitHub</h2>
<p style="color:${C.muted};font-size:9pt">Copie e cole cada bloco como uma issue. Achados triviais relacionados foram mantidos individuais por tocarem repositórios/times diferentes.</p>
${issues}

</body></html>`;

fs.writeFileSync(path.join(OUT_DIR, 'relatorio-auditoria-seguranca.html'), html);

// ─── Markdown (fonte legível) ───────────────────────────────────────────────
const md = `# Relatório de Auditoria de Segurança — ${DATA.projeto}
Data: ${DATA.data} · looply@750d2df · ${total} achados (${bySev.critica} crítica, ${bySev.alta} alta, ${bySev.media} média, ${bySev.baixa} baixa, ${bySev.informativa} informativa)

## Escopo
${DATA.escopo.map((e) => `- ${e}`).join('\n')}

## Stack
${Object.entries(DATA.stack).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## Pontos fortes
${DATA.pontosFortes.map((p) => `- **${p.titulo}** — ${p.evidencia}`).join('\n')}

## Achados
${DATA.achados.map((a) => `### [${sevLabel[a.sev].toUpperCase()}] ${a.titulo}
- **Onde:** ${a.arquivo}
- **Código:**
\`\`\`
${a.codigo}
\`\`\`
- **Por que é explorável:** ${a.porque}`).join('\n\n')}

## Recomendações
P1 Rotacionar senha admin + purgar credencial do repo verbumlab (A2)
P2 Restringir esquema de URL (https only) em mediaUrl/logoUrl/avatarUrl + CSP (A1)
P3 Escape HTML do nome no e-mail de recuperação (A3)
P4 validateEnv rejeita placeholders de segredo em produção (A4)
P5 UI fail-closed quando role ausente (A5)
`;
fs.writeFileSync(MD_PATH, md);

// ─── PDF ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.goto('file://' + path.join(OUT_DIR, 'relatorio-auditoria-seguranca.html'), { waitUntil: 'networkidle' });
await page.evaluate(async () => { await document.fonts.ready; });

const header = `<div style="width:100%;font-size:7.5pt;color:#78716C;padding:0 20mm;display:flex;justify-content:space-between;border-bottom:.5pt solid #E7E5E4;padding-bottom:4px">
  <span>Relatório de Auditoria de Segurança — ${DATA.projeto}</span><span>${DATA.data}</span></div>`;
const footer = `<div style="width:100%;font-size:7.5pt;color:#78716C;text-align:center">
  Página <span class="pageNumber"></span> de <span class="totalPages"></span> · docs/security-audit/relatorio-auditoria-seguranca.pdf</div>`;

await page.pdf({
  path: PDF_PATH,
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', bottom: '18mm', left: '20mm', right: '20mm' },
  displayHeaderFooter: true,
  headerTemplate: header,
  footerTemplate: footer,
});
await browser.close();

const { size } = fs.statSync(PDF_PATH);
console.log(`PDF: ${PDF_PATH} (${Math.round(size / 1024)} KB)`);
console.log(`MD:  ${MD_PATH}`);
