# Audit: site inteiro (visant-killer)

`killer-scan --all src` (82 tsx, ~15 rotas). Branch `audit/visant-killer-site-2026-10-31`.

## Estado final do gate

| Detector | Antes | Agora |
|---|---|---|
| impeccable (AI tell) | zero | **zero** |
| audit:design (token) | 54 | **zero** |
| copy (tic) | 38 | 38 — convenção (ver abaixo) |
| noise (chrome) | 63 | 14 — convenção/taste (ver abaixo) |

`tsc --noEmit` limpo; `npm run test` 355/355 em cada bateria.

## Aplicado (defeitos confirmados — commits nesta branch)

1. **LAW/proibições:** 13 `arrow-glyph` (`→ ← ↑ ↓` → ícones), 1 `hover-lift`
   (`hover:scale-105`), 1 `blur-on-card`.
2. **tile-img-no-onerror (14):** `onError` em todo `<img>` (avatares caem pra
   iniciais; logos pontuais escondem imagem quebrada).
3. **audit:design (54 → 0):** classes de paleta / hex → tokens. `StatusPill`
   ganhou tokens categóricos `--looply-color-stage-*`; erro/sucesso/danger usam
   tokens semânticos; dado legítimo (logo, temas, `brandColor`, cor categórica)
   leva exceção escrita.
4. **hand-drawn-icon (21 → 0):** ~51 SVG inline centralizados no `Icons.tsx`
   (16 ícones novos + reuso), sem dependência nova. Relocação verbatim.
5. **usage-instruction (1):** removida a instrução "Clique em…" do empty state
   de arquivos.

## NÃO aplicado — convenção/falso-positivo/taste (Rule zero: proposta, não fix)

- **copy `bullet-separator`+`em-dash` (38):** o `·` é o separador de metadados do
  app inteiro; **`copy-lint` canônico (visant-copy) passa limpo** — só o detector
  embutido do killer-scan acusa. Mudar é mudança de convenção, decisão do dono.
- **noise `box-in-box` (8, AuthShell):** é o **mock de preview** do produto
  (dashboard fake com cards aninhados de propósito). Flatten quebraria o mock.
- **noise `shouting-label` (3, ClientDetail):** labels uppercase = mesmo padrão do
  componente `Eyebrow` usado no app todo.
- **noise `caption-of-what-follows` (2, ChatWindow):** copy de empty-state; reescrita
  é subjetiva.

## Não executado

- **Browser (Step 5):** overflow 390px, tema claro, backend-down, teclado, feel.
  Sem playwright nem app com DB no ambiente. Pendente.
