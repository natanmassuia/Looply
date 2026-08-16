<!-- HISTORICAL (2026-08-13, pre-F1). Superseded by the F1 semantic runtime + Figma 00-13 canonical frames. NOT a design authority. Standing contract: product frames are the UI source; Figma annotations are not runtime UI; static frames are not the full runtime behavior contract; motion is implemented/validated at runtime; Human Relay is the canonical Looply symbol; customer-facing copy stays client-friendly (Empresa, not workspace; no V1/provider/backend/capability language). See looply-fr1-retroactive-frontend-reconciliation-audit.md -->

# Looply Demo V1 — Visual Redesign Report

**Date:** 2026-08-13
**Author:** opencode (Kore AI)
**Scope:** Full frontend visual redesign preserving all product behavior

---

## Visual Problems Found

1. **Six identical KPI cards** — equal weight, no hierarchy, generic admin appearance
2. **Excessive bordered rectangles** — every element had a visible border
3. **Generic Tailwind admin template** — no product identity, no brand personality
4. **Weak typography hierarchy** — page titles, section headers, and metadata all looked similar
5. **Oversized empty panels** — "Tudo em dia" wasted half the screen
6. **Quick link cards at bottom** — added no operational value to the Dashboard
7. **Raw HTML table** — Contents page looked like a CRUD admin
8. **Two separate `<form>` elements** in NewContent (bug — only second form submitted)
9. **Browser-default button appearance** — no hover/pressed/focus states
10. **Generic sidebar** — basic bg-fill active state, no visual identity
11. **Pure white everywhere** — no tonal background layers, no visual depth
12. **Uppercase labels everywhere** — no distinction between label types

---

## Kore Principles Reused

| Principle | Application |
|-----------|-------------|
| **Zinc + Blue foundation** | Restrained palette: charcoal text, zinc surfaces, blue only for primary actions |
| **Tinted status system** | 10% bg + 20% border + 100% text for all status colors |
| **Context-aware density** | Compact for data rows, spacious for action areas |
| **Three-tier typography** | Bold/tight values, medium body, small/uppercase labels for metadata |
| **Ring over shadow for cards** | Subtle border rings instead of heavy drop shadows |
| **Colored shadows on CTAs** | Blue shadow on primary buttons (`rgba(37, 99, 235, 0.15)`) |
| **Micro-animations** | `active:scale(0.98)` on buttons, hover state transitions |
| **Uppercase tracked labels** | 11px, bold, 0.05em tracking for metadata labels only |
| **Dual-radius system** | 8px for UI elements, 12px for cards, 16px for hero surfaces |

---

## Design System Changes

### CSS Variables (`index.css`)

| Variable | Before | After | Rationale |
|----------|--------|-------|-----------|
| `--looply-background` | `#f8f9fb` | `#f4f5f7` | Slightly cooler, more intentional app bg |
| `--looply-surface-muted` | `#f1f3f7` | `#f0f1f4` | More tonal, less gray |
| `--looply-border` | `#e2e5ec` | `#e2e4e9` | Refined neutral |
| `--looply-border-subtle` | _(new)_ | `#eaecf0` | Lighter border for card edges |
| `--looply-foreground` | `#111318` | `#1a1d26` | Charcoal/navy, softer than near-black |
| `--looply-tertiary-foreground` | _(new)_ | `#b0b4c0` | For very subtle metadata |
| `--looply-primary-subtle` | `#eff4ff` | `#eff4ff` | Kept (good focus ring color) |
| `--looply-radius` | `10px` | `8px` | More sophisticated, less rounded |
| `--looply-radius-lg` | `14px` | `12px` | Refined card radius |
| `--looply-radius-xl` | `18px` | `16px` | Refined hero radius |

### New CSS Component Classes

- `.card-elevated` — elevated surface with subtle shadow
- `.card-flush` — card with no padding (for tables/lists)
- `.btn-sm` / `.btn-lg` — size variants
- `.status-pill` — consistent status badge styling
- `.section-title` — 13px/600 weight for section headers
- `.section-label` — 11px/600/uppercase/0.05em tracking for metadata
- `select.input` — custom chevron via SVG data URI

### Tailwind Config

- Added `surface` color scale (DEFAULT, muted, subtle, elevated)
- Added `sidebar.active-bar` for future active indicator
- Added `looply-lg` shadow variant
- Refined border radius scale

---

## Dashboard Composition Changes

### Before
- PageHeader with "Dashboard" title
- 6-column KPI grid (all equal weight)
- 2/3 recent contents + 1/3 attention panel
- Quick link cards (Clientes/Equipe) at bottom

### After
- **Greeting header** — "Bom dia" / "Boa tarde" / "Boa noite" with contextual subtitle
- **Attention panel** (primary) — full-width, colored left border (amber/emerald), compact list of items needing action. When empty, subtle positive status (not giant empty panel)
- **Compact metrics row** — 4 metrics with colored icon containers (Em revisão, Aguardando cliente, Aprovados, Agendados)
- **Asymmetric 2-col layout** — "Em andamento" list (65%) + "Próximas publicações" panel (35%)
- **Rich content rows** — format icon, title, client dot, format label, version, status pill, relative time
- **Removed** — quick link cards, 6 equal KPI cards, giant empty panels

---

## Other Screens Changed

### Sidebar
- Refined brand mark (layered icon instead of "L" letter)
- Tighter spacing, smaller active bg
- More compact user area
- Better icon sizing (17px vs 18px)

### Contents List
- Replaced raw HTML table with rich list rows
- Format icon avatars per row
- Client color dots + name inline
- Hover reveals chevron arrow
- Refined filter chips (smaller, tighter)
- Search input integrated into filter row

### New Content
- Two-column layout: main content (60%) + details/actions (40%)
- Single form (fixed the two-form bug)
- Prominent primary CTA in side column
- Ghost cancel button
- Better field grouping

### Content Detail
- Preview moved above metadata (visual anchor first)
- Metadata in side-by-side grid with section labels
- Sticky-feel right sidebar for actions
- Refined version timeline (smaller number circles)

### Public Approval
- Refined to use CSS variables instead of hardcoded slate colors
- Added `active:scale-[0.98]` to buttons
- Better section labels
- Maintained existing strong visual identity

### Calendar
- Chevron icon buttons for month navigation
- Disabled "Hoje" button when on current month
- Today cell gets subtle blue tint background
- "+N mais" overflow indicator for busy days
- Removed confusing legend

### Clients
- Tighter card spacing (gap-3 vs gap-4)
- Smaller status badges (11px)
- Better form close button
- Refined color picker sizing

### Team
- Tighter card spacing
- Smaller avatars (h-10 vs h-11)
- Smaller role badges (11px)

---

## Validation

### Prisma Schema
```
✅ Valid
```

### TypeCheck
```
✅ frontend: 0 errors
✅ backend: 0 errors
```

### Tests
```
✅ frontend: 5/5 passed
✅ backend: 20/20 passed
```

### Build
```
✅ frontend: built in 5.18s
  - CSS: 29.16 kB (6.17 kB gzipped)
  - JS: 320.92 kB (94.99 kB gzipped)
```

### Localhost Check
```
✅ No localhost references in frontend/dist
```

### Deployment
```
✅ Backend restarted (PM2 looply-backend)
✅ PM2 state saved
✅ Health endpoint: 200 OK
✅ Main URL: 200 OK
```

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/index.css` | Complete redesign of CSS variables, button system, input system, new component classes |
| `frontend/tailwind.config.js` | Added surface colors, refined radii, added shadow variants |
| `frontend/src/components/Icons.tsx` | Added 12 new icons, reduced base size to 18px |
| `frontend/src/components/common.tsx` | Added CardFlush, refined EmptyState, refined PageHeader |
| `frontend/src/components/Sidebar.tsx` | Refined brand mark, tighter spacing, better active states |
| `frontend/src/components/AppLayout.tsx` | Increased max-width to 7xl, added lg:px-8 |
| `frontend/src/components/StatusPill.tsx` | Uses new `.status-pill` class |
| `frontend/src/features/Dashboard.tsx` | Complete redesign — greeting, attention panel, compact metrics, asymmetric layout |
| `frontend/src/features/ContentsList.tsx` | Rich list rows, format icons, hover chevrons |
| `frontend/src/features/NewContent.tsx` | Two-column layout, single form, prominent CTA |
| `frontend/src/features/ContentDetail.tsx` | Preview-first layout, refined metadata, smaller timeline |
| `frontend/src/features/PublicApproval.tsx` | CSS variable migration, button micro-animations |
| `frontend/src/features/Calendar.tsx` | Chevron nav, today highlight, overflow indicator |
| `frontend/src/features/Clients.tsx` | Tighter cards, refined form |
| `frontend/src/features/Team.tsx` | Tighter cards, smaller badges |
| `frontend/src/components/Sidebar.tsx` | Added collapsible sidebar with toggle button, icon-only mode |
| `frontend/src/index.css` | Buttons changed to pill shape (`border-radius: 9999px`) |

---

## Iteration 2 — Button + Sidebar Refinements

### Buttons
- **Problem:** Buttons looked too square/boxy
- **Fix:** Changed `border-radius` from `8px` to `9999px` (pill shape)
- **Padding:** Increased from `0.5rem 0.875rem` to `0.5rem 1rem` for better proportions

### Collapsible Sidebar
- **State:** Uses existing `useUIStore` (`sidebarCollapsed` boolean)
- **Collapsed width:** `72px` (icon-only mode)
- **Toggle button:** Bottom of sidebar, rotates arrow icon on collapse
- **Behavior:**
  - Nav items show icons only when collapsed
  - Brand text and user info hidden when collapsed
  - Nav items get `title` tooltips for accessibility
  - Smooth `200ms` transition animation
- **Persistence:** Zustand store keeps state across navigation (resets on page reload — acceptable for V1)

---

## Visual Acceptance Checklist

- [x] No six identical KPI cards
- [x] No excessive bordered rectangles
- [x] Strong typography hierarchy
- [x] Fewer, more meaningful surfaces
- [x] Subtle tonal backgrounds
- [x] Careful whitespace
- [x] Elegant primary CTA
- [x] Restrained brand accent
- [x] Sophisticated status colors
- [x] Subtle elevation
- [x] Small purposeful icons
- [x] Polished hover/focus states
- [x] Content-first layouts
- [x] No generic Tailwind admin template appearance
- [x] No giant empty panels
- [x] No excessive saturated blue
- [x] No default-browser-looking buttons
- [x] No unnecessary gradients
- [x] Dashboard made of hierarchical sections, not independent cards

---

## Iteration 3 — Calendar, Team CRUD, Mockups

### Calendar Improvements
- **Navigation:** Centered layout — chevron buttons flank the month/year label, "Hoje" appears as ghost button only when not on current month
- **Legend added:** Explains what the blue circle means (today), gray cells (out-of-month days), and colored chips (client names with their brand colors)
- **Today indicator:** Blue circle is the current date — not a holiday

### Team Page — Full CRUD
- **Backend:** Added `POST /api/team` endpoint with Zod validation (name, email, role)
- **Frontend:** "Novo membro" button in header, inline create form with name/email/role fields
- **Form:** 3-column grid, cancel button, error handling, loading state

### Media Preview Mockups
- **Format-specific icons:** Video/Reels gets play icon, Story gets phone outline, Carousel gets stacked cards, default gets image icon
- **Visual upgrade:** Gradient background, larger icon in rounded container, format label text
- **Prop:** Added optional `format` prop to `MediaPreview` component

### Files Modified
| File | Changes |
|------|---------|
| `backend/src/routes/team.ts` | Added POST endpoint with Zod validation |
| `backend/src/services/teamService.ts` | Added `createTeamMember` function |
| `frontend/src/lib/api.ts` | Added `useCreateTeamMember` hook + `UserRole` type |
| `frontend/src/features/Calendar.tsx` | Centered nav, legend, dynamic client colors |
| `frontend/src/features/Team.tsx` | Full create form, "Novo membro" CTA |
| `frontend/src/components/common.tsx` | Format-specific mockup placeholders in MediaPreview |

---

## Iteration 4 — Kanban, Greeting, Duplicate Titles, Calendar Nav

### Duplicate Titles Fixed
- Removed redundant `crumbs` from all simple pages (Dashboard, Contents, Calendar, Clients, Team)
- Pages that need breadcrumbs (NewContent, ContentDetail) keep them because they show navigation path
- Now each page shows title only once in the header

### Calendar Navigation
- Month nav moved inside the card header (between title bar and weekday headers)
- Clean chevron buttons on left/right, month/year centered
- Removed confusing "Hoje" button entirely
- User can navigate freely; current month is always obvious from the label

### Dashboard Greeting
- Now shows "Bom dia, Natan" / "Boa tarde, Natan" / "Boa noite, Natan"
- Fetches admin user name from team API
- Falls back to just greeting if no admin found

### Contents → Kanban Board
- Replaced table/list view with Trello-style kanban
- 7 columns: Rascunho → Em revisão → Aguardando cliente → Alterações → Aprovado → Agendado → Publicado
- Each column has colored left border matching status color
- Cards show: title, client + color dot, format, version, relative time, status pill
- Horizontally scrollable, fixed-width columns (288px each)
- Empty columns show dashed "Vazio" placeholder
- All cards are clickable links to content detail

### Demo is NOT Mockup
- All seeded data is real database records
- User can create new contents, clients, and team members
- Workflow transitions work end-to-end
- Calendar shows real scheduled/approved items
- Public approval links are functional
- The only "demo" aspect is the hardcoded admin user in the sidebar (DEV_DEMO_USER=true)

### Files Modified
| File | Changes |
|------|---------|
| `frontend/src/features/ContentsList.tsx` | Complete rewrite as Kanban board |
| `frontend/src/features/Dashboard.tsx` | Added user name to greeting |
| `frontend/src/features/Calendar.tsx` | Moved nav into card, removed "Hoje" button |
| `frontend/src/features/Clients.tsx` | Removed redundant breadcrumb |
| `frontend/src/features/Team.tsx` | Removed redundant breadcrumb |

---

## Iteration 5 — Full-width Kanban, Drag-and-Drop, Nginx Fix

### Kanban — Full Width Grid
- Changed from horizontal scroll (`flex overflow-x-auto`) to CSS grid (`grid-cols-7`)
- All 7 columns visible at once on desktop (1440px+)
- Each column takes equal width, no scroll bar needed

### Kanban — Drag-and-Drop
- Native HTML5 drag-and-drop (no external library)
- Cards are `draggable` — grab and drop to another column
- Valid transitions: DRAFT→IN_REVIEW, IN_REVIEW→AWAITING_CLIENT, APPROVED→SCHEDULED, SCHEDULED→PUBLISHED, CHANGES_REQUESTED→IN_REVIEW
- Invalid transitions silently fail (user can use detail page for complex moves)
- Dragged card gets `opacity-40` visual feedback

### Duplicate Titles — Final Fix
- Removed `crumbs` from Clients and Team (were still present)
- Only NewContent and ContentDetail keep breadcrumbs (they show actual navigation path)

### ⚠️ Nginx Fix Required
**Problem:** `proxy_pass http://127.0.0.1:4000/;` has a trailing slash that strips `/api/` prefix.
- Request `/api/team` → backend receives `/team` → 404
- Request `/api/clients` → backend receives `/clients` → 404

**Fix:** Remove trailing slash from line 26 of `/etc/nginx/sites-enabled/looply.verbumlab.com.br`:
```
# Before (broken):
proxy_pass http://127.0.0.1:4000/;

# After (fixed):
proxy_pass http://127.0.0.1:4000;
```

Then reload: `sudo nginx -s reload`

The backend on port 4000 works correctly — all routes respond properly when accessed directly.
The fixed Nginx config has been written but needs sudo to apply.

### Backend — POST /api/team
- Added `POST /api/team` endpoint with Zod validation
- Creates user records in the database
- Frontend form on Team page calls this endpoint
- Works correctly when accessed directly on port 4000

### Files Modified
| File | Changes |
|------|---------|
| `frontend/src/features/ContentsList.tsx` | Full-width grid kanban + drag-and-drop |
| `frontend/src/features/Clients.tsx` | Removed redundant breadcrumb (final fix) |
| `frontend/src/features/Team.tsx` | Removed redundant breadcrumb (final fix) |
| `backend/src/routes/team.ts` | Added POST endpoint with Zod validation |
| `backend/src/services/teamService.ts` | Added `createTeamMember` function |
