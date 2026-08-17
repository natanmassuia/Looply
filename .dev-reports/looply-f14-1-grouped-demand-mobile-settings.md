# F14.1 — Grouped Demand Containment + Mobile Settings Navigation

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: reproduce grouped-card overflow in the Kanban column layout, fix at the
minimal structural layer (status pill + metadata row), add a direct mobile
Settings entry in the always-visible header (not via the account menu), and
verify against the live `https://looply.verbumlab.com.br` runtime. Frontend-only.
No backend files changed. No migration. No commit. No push.

## Baseline
- F14 LIVE VERIFIED state: backend 432 tests, frontend 214 tests, public
  upload + appearance + settings + channels repaired.
- Working tree dirty: 55 entries at start (F12.2 → F14 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving
  `/opt/looply/frontend/dist`, Docker MinIO + Redis.

## Reproduction

Grouped Demandas cards render inside a `grid grid-cols-7 min-w-[980px]` Kanban
(`ContentsList.tsx:212`). Each column is ~140px. The grouped card (`CardStack`)
has a bordered group container (`rounded-xl border p-3`) containing child demand
cards (`rounded-lg border px-2.5 py-1.5`).

Reproduced at all widths where a Kanban column is narrow (1024px horizontal
scroll zone, 390px mobile, and 1440px full-width because `min-w-[980px]` keeps
columns ~140px):

```
GROUPED_CARD_OVERFLOW_REPRODUCED: YES
```

The child card metadata row (`flex items-center gap-1`) holds
`format · <StatusPill status="AWAITING_CLIENT">`. The pill is `inline-flex`
with no `min-w-0`; as a flex item its `min-width:auto` = min-content =
" A guardando " (longest word) + padding + dot, so it refuses to shrink below
that and pushes the row wider than the child card content box → the pill
visibly escapes the `rounded-lg` child card and the group border. Long titles
collide with the badge on narrow cards; the row has no `flex-wrap`, so nothing
can drop to the next line.

## Grouped Demand Root Cause

```
GROUPED_CARD_ROOT_CAUSE: metadata row in grouped child cards is a non-wrapping
  flex row (flex items-center gap-1) whose StatusPill flex item has implicit
  min-width:auto; on narrow Kanban columns the pill's min-content
  ("Aguardando" + padding) exceeds the child card content width and escapes the
  group border.
STATUS_BADGE_ROOT_CAUSE: .status-pill is inline-flex with line-height:1 and no
  min-w-0 / whitespace-normal; label text cannot wrap or shrink inside the
  pill, so the badge is forced to full text width and overflows.
```

## Group Container Repair

Container contract already correct: `CardStack` group wrapper is a block-level
bordered card; children stack via `space-y-1` and always take the parent's
content width. The fix did NOT touch the container — the overflow originates in
the child card internals, so that is where the minimal fix lands.

## Child Card Containment

`ContentsList.tsx` grouped child card metadata row:

```jsx
<div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-muted">
  <span>{FORMAT_LABEL[child.format]}</span>
  <span>·</span>
  <StatusPill status={child.status} />
</div>
```

- `min-w-0` on the row (inside the existing `min-w-0 flex-1` title wrapper)
  lets the row shrink below content min-width.
- `flex-wrap` lets format/separator/badge flow to their own lines when the card
  is narrow — badge drops below title/metadata instead of escaping.

## Status Badge Containment

`StatusPill.tsx`:

```jsx
<span className={`status-pill min-w-0 max-w-full ${STATUS_STYLE[status]}`}>
  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`} />
  <span className="min-w-0 whitespace-normal">{STATUS_LABEL[status]}</span>
</span>
```

- `min-w-0 max-w-full` lets the pill shrink within its flex/grid parent.
- Label is wrapped in a real `<span>` with `whitespace-normal` so long statuses
  ("Aguardando cliente") wrap inside the pill instead of clipping/escaping.
- Dot keeps `shrink-0`; label wraps around it.
- `.status-pill` line-height relaxed 1 → 1.15, `text-align:left` for multi-line
  pills.

```
STATUS_BADGE_CONTAINED: YES
STATUS_BADGE_WRAPPING:  YES
```

## Stress Case

Fixture: 3 grouped demands, long client/company name, long child title
("Campanha especial de lançamento de inverno"), statuses mixed
("Aguardando cliente", "Em revisão", "Aprovado"), metadata "Carrossel · v12".
At 390/430/768/1024/1440px every badge and child card stays inside the bordered
group container; the group grows vertically as needed; no horizontal page
overflow.

```
GROUP_STRESS_CASE: PASS
GROUPED_STATUS_ACCESSIBLE: YES (full label text always rendered; no sr-only
  substitution, no truncation, no hidden status)
```

## Desktop QA

At 1440px and 1024px the Kanban uses `min-w-[980px]` so columns stay ~140px —
this is exactly the narrowest stress regime. Verified no child card or badge
escapes the group border, no overlap, group border correct, vertical growth
only.

```
GROUPED_CARD_OVERFLOW_1440: NO
GROUPED_CARD_OVERFLOW_1024: NO
```

## Mobile QA

At 390px: grouped container fits viewport; child cards fit; "Aguardando
cliente" badge stays inside; long labels wrap safely; no horizontal page
overflow (outer `overflow-x-auto` owns the Kanban scroll, page never scrolls
horizontally); Desagrupar demandas button reachable and not overlapped; card
tap target preserved.

```
GROUPED_CARD_OVERFLOW_MOBILE: NO
MOBILE_HORIZONTAL_OVERFLOW:   NO
```

## Mobile Navigation Audit

```
MOBILE_SETTINGS_CURRENT_ACCESS: only inside the AccountMenu ("Conta") secondary
  list, next to Equipe — an indirect, account-adjacent path.
MOBILE_NAV_ARCHITECTURE: bottom nav = 4 primary operational items (Dashboard,
  Clientes, Demandas, Agenda); header = logo/home + account menu; secondary
  destinations (Equipe, Configurações) lived only inside the account dropdown.
```

## Settings Placement

Chose the least disruptive option consistent with the existing architecture:
a dedicated Settings icon in the always-visible mobile header (beside the
account menu), NOT a 5th bottom-nav item. The header lives inside the `h-dvh`
shell, so the entry is reachable from any scroll position. Settings stays a
workspace/product destination; Minha conta / logout remain in the account menu.

```
MOBILE_SETTINGS_PLACEMENT: dedicated IconSettings NavLink in mobile header
  (beside AccountMenu); bottom nav unchanged at 4 items.
```

## Settings Navigation

```
MOBILE_SETTINGS_ENTRY:         YES — header icon, aria-label/title "Configurações"
MOBILE_SETTINGS_NAVIGATION:    YES — canonical /settings route
MOBILE_SETTINGS_MENU_CLOSE:    N/A (header link is not inside a drawer/menu)
MOBILE_SETTINGS_ACTIVE_STATE:  YES — NavLink renders aria-current="page" + brand color
MOBILE_SETTINGS_REACHABLE_AFTER_SCROLL: YES — header is fixed within the h-dvh
  shell at top, mid-scroll and bottom; no scroll-to-top required
```

## Accessibility

- Grouped status: full readable label always in the DOM (no `sr-only` swap, no
  truncation); wrapping keeps text legible at all widths.
- Mobile Settings: accessible name from `aria-label` only (icon is
  `aria-hidden`, no duplicate `sr-only` text); 36px hit target; `focus-visible`
  ring; keyboard activable (NavLink).
- Desagrupar demandas: still exactly one button per group (`aria-label`).

```
GROUPED_STATUS_ACCESSIBLE: YES
MOBILE_SETTINGS_ACCESSIBLE: YES
```

## F14 Regression

Live smoke (same endpoints F14 repaired):
- login 200, appearance PATCH with `customColors:null` 200, company name/timezone 200.
- upload-intent 201, URL host = `looply.verbumlab.com.br` (no 127.0.0.1/localhost).
- Avatar/company/client media controls unchanged (no source touch).

```
F14_REGRESSION: PASS
```

## Runtime Activation

- Frontend-only: `npm run build` → new bundle `index-CcoBZNmN.js`.
- Nginx serves `/opt/looply/frontend/dist` (unchanged root); served HTML
  references the new hashed bundle → artifact is live without Nginx reload.
- No backend change → no backend reload. No Nginx config change → no Nginx reload.
- Kore untouched.

```
FRONTEND_ARTIFACT_CURRENT: YES
LOOPLY_BACKEND_RELOADED:   NO
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Backend tests  | 432    | 432   |
| Frontend tests | 214    | 224   |

Frontend additions (jobs.test.tsx + shell.test.tsx):
- Grouped child card shrink-safe source contract (`min-w-0 flex-1`, wrapping
  metadata row).
- Grouped child wrapper bordered/contained; no absolute/negative positioning in
  the grouped block.
- Long titles truncate inside grouped children.
- "Desagrupar demandas" rendered exactly once per group.
- StatusPill min-w-0/max-w-full + whitespace-normal label contract; label never
  sr-only/hidden/truncated.
- Mobile header direct Configurações link (aria-label/title, IconSettings,
  `to="/settings"`).
- Settings NOT in bottom nav (4-item contract preserved).
- Runtime `aria-current="page"` on the mobile Settings link when active
  (scoped to the header because the desktop Sidebar also renders one).

## Resource Safety

```
AVAILABLE_RAM_START: ~1.7 Gi
AVAILABLE_RAM_FINAL: ~1.6 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build.
Backend suite not rerun (no backend change this session).

## Git Status

Working tree preserved (F12.2 → F14 → F14.1). This session touched only:
`frontend/src/components/StatusPill.tsx`, `frontend/src/features/ContentsList.tsx`,
`frontend/src/components/AppLayout.tsx`, `frontend/src/index.css`,
`frontend/src/tests/jobs.test.tsx`, `frontend/src/tests/shell.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.7 Gi
AVAILABLE_RAM_FINAL:                       ~1.6 Gi

GROUPED_CARD_OVERFLOW_REPRODUCED:          YES
GROUPED_CARD_ROOT_CAUSE:                   non-wrapping flex metadata row + StatusPill min-width:auto
STATUS_BADGE_ROOT_CAUSE:                   .status-pill inline-flex without min-w-0 / wrapping label

GROUPED_CARD_OVERFLOW_1440:                NO
GROUPED_CARD_OVERFLOW_1024:                NO
GROUPED_CARD_OVERFLOW_MOBILE:              NO
MOBILE_HORIZONTAL_OVERFLOW:                NO

STATUS_BADGE_CONTAINED:                    YES
STATUS_BADGE_WRAPPING:                     YES
GROUP_STRESS_CASE:                         PASS
GROUPED_STATUS_ACCESSIBLE:                 YES

MOBILE_SETTINGS_CURRENT_ACCESS:            account menu only (indirect)
MOBILE_SETTINGS_PLACEMENT:                 dedicated header icon (bottom nav unchanged, 4 items)
MOBILE_SETTINGS_ENTRY:                     YES
MOBILE_SETTINGS_NAVIGATION:                YES (/settings)
MOBILE_SETTINGS_MENU_CLOSE:                N/A (no drawer involved)
MOBILE_SETTINGS_ACTIVE_STATE:              YES
MOBILE_SETTINGS_REACHABLE_AFTER_SCROLL:    YES
MOBILE_SETTINGS_ACCESSIBLE:                YES

F14_REGRESSION:                            PASS

BACKEND_FILES_CHANGED:                     0
MIGRATION_CREATED:                         NO

BACKEND_TESTS:                             432
FRONTEND_TESTS:                            224
BACKEND_TYPECHECK:                         PASS (unchanged, not rerun)
FRONTEND_TYPECHECK:                        PASS
BACKEND_BUILD:                             PASS (unchanged, not rerun)
FRONTEND_BUILD:                            PASS

FRONTEND_ARTIFACT_CURRENT:                 YES
LOOPLY_BACKEND_RELOADED:                   NO

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none

KORE_TOUCHED:                              NO
```

F14.1 GROUPED DEMANDS + MOBILE SETTINGS — LIVE VERIFIED