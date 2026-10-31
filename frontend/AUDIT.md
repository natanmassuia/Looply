# Audit: site inteiro (visant-killer)

Rodado em `src` (82 arquivos tsx, ~15 rotas). `killer-scan --all`.
Gate: `impeccable` **zero**; `audit:design` 54; `copy` 38; `noise` 63.

## Aplicado (defeitos reais confirmados — este branch)

| Regra | Qtd | O que mudou |
|---|---|---|
| `arrow-glyph` (LAW) | 13 | `→ ← ↑ ↓` como texto viraram componentes de ícone (`IconArrowRight` novo em `Icons.tsx`; reuso de `IconArrowLeft`/`IconChevronUp`/`IconChevronDown`). Arquivos: ClientDemandsModal, ClientDetail, Clients (×3), MyAccountModal, Recovery (×2), ResetPassword (×2), WhatsAppManagement, ContextPanel. |
| `hover-lift` (LAW) | 1 | `MessageList`: `transition-all hover:scale-105 active:scale-95` → `transition-colors hover:bg-subtle hover:border-strong`. |
| `blur-on-card` | 1 | `PublicApproval`: removido `backdrop-blur-sm` do avatar do header. |
| `tile-img-no-onerror` | 14 | `onError` em todo `<img>`. Avatares compartilhados (`ClientAvatar`, `ContactAvatar`) caem para iniciais via estado; avatares/logos pontuais (AppLayout, Sidebar ×3, common, ImageUpload, Team ×2, Settings, MyAccountModal) escondem a imagem quebrada. |

Verificado: `tsc --noEmit` limpo; `npm run test` 355/355; re-scan dessas regras = zero.

## NÃO aplicado — decisão sua (a skill não vira isso em fix sozinha)

1. **`hand-drawn-icon` (21)** — o repo tem sistema de ícone local (`Icons.tsx`, SVG
   inline, sem lib). É arquitetura, não 21 bugs. Migrar p/ `lucide-react`/
   `@phosphor-icons/react` adiciona dependência e mexe em 15+ arquivos.
2. **`audit:design` token (54)** — `StatusPill` e vários usam classes de paleta
   Tailwind (`bg-slate-400`, `bg-amber-500`, `bg-red-500`…). Converter p/ tokens
   semânticos exige **criar tokens de status** que não existem (draft/review/
   scheduled/published; só há success/warning/danger/info). Parte são dado
   legítimo (temas em `Settings`, logo em `Logo.tsx`, `brandColor` dinâmico) =
   falso-positivo da regra.
3. **`copy` bullet-separator + em-dash (38)** — `·` é o separador de metadados do
   app inteiro; `copy-lint` canônico passa limpo. Convenção, não defeito.
4. **`box-in-box` (8, AuthShell), `shouting-label` (3), `caption`/`usage` (3),
   `opacity-ladder` (1, kanban ContentsList)** — taste/estrutura; proposta, não fix.

## Não executado

- **Browser (Step 5):** overflow 390px, tema claro, backend-down, teclado, feel.
  Sem playwright nem app com DB neste ambiente. Pendente.
