# F14.6.1 — Sidebar Identity + Demand Kanban Containment Repair

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: reproduced and repaired two presentation defects against the real runtime authority (not
prior PASS claims): (1) the company logo occupied the Looply product-brand slot in the desktop
sidebar; (2) the Demandas Kanban squeezed 7 columns into the viewport, compressing cards so content
escaped, grouped actions competed, and titles truncated inconsistently. Frontend-only. No backend
change. No migration. No commit. No push.

## Baseline
- F14 → F14.6 LIVE VERIFIED (backend 434 tests, frontend 262 tests).
- Working tree dirty: 78 entries at start (F12.2 → F14.6 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Sidebar Root Cause

```
SIDEBAR_PRODUCT_BRAND_NODE:    <Link to="/dashboard"> containing the brand mark + "Looply" text
SIDEBAR_WORKSPACE_NODE:        (before) the same single <Link> block — no separate workspace row
COMPANY_LOGO_RENDER_LOCATION:  (before) the product-brand <Link> slot — it replaced <Logo> when set
LOOPLY_LOGO_RENDER_LOCATION:   (before) only shown when companyLogoUrl was absent (conditional)
CURRENT_VISUAL_COLLISION:      YES — when a company logo existed, <img> (company logo) replaced the
                               Looply product mark in the brand block; product + workspace identity
                               were fused into one row
```

Root cause: the sidebar rendered `companyLogoUrl ? <img company logo> : <Logo product>` inside the
single product-brand link. A company with a logo visually white-labeled the product mark.

## Sidebar Canonical Identity

Repaired by splitting into two clearly separated rows:

- **TOP — fixed Looply product brand:** always renders `<Logo>` (Human Relay geometry) + "Looply"
  text inside the home-affordance link. The product mark is static brand content, never derived from
  `workspace.logoUrl` / `company.logoUrl` / tenant state.
- **BELOW — workspace identity row:** a separate bordered row with the company logo (or initials
  fallback) + company name. Clearly distinct from the product brand.

```
SIDEBAR_PRODUCT_WORKSPACE_SEPARATED: YES
COMPANY_LOGO_REPLACES_PRODUCT_LOGO:  NO (after fix)
PRODUCT_BRAND_DATA_SOURCE:            static Looply brand (Logo + "Looply")
WORKSPACE_IDENTITY_DATA_SOURCE:       me/workspace/company projection (workspace.logoUrl + name)
WORKSPACE_INITIALS_FALLBACK:          YES (initials when no logo; e.g. "LT" for Loyal Tech)
LONG_WORKSPACE_NAME_CONTAINMENT:      YES (workspace name uses truncate + min-w-0)
```

The company logo now renders in the workspace row, not the product slot. V1 is not white-label.

## Kanban Layout Audit

```
KANBAN_CONTAINER:              ContentsList board region
KANBAN_COLUMN_WIDTH:           (before) grid-cols-7 split of min-w-[980px] / xl:min-w-0 → columns
                               squeezed to share the viewport equally
KANBAN_COLUMN_MIN_WIDTH:       none (columns could shrink arbitrarily)
KANBAN_HORIZONTAL_SCROLL:      (before) xl:min-w-0 disabled the horizontal scroll at large widths
CARD_WIDTH:                    100% of the squeezed column → too narrow
GROUP_CARD_WIDTH:              same squeeze
GROUP_CHILD_WIDTH:             same squeeze
```

## Column Width / Scroll Strategy

Repaired the board to prefer stable usable column widths over compressing every column:

```
BOARD_COMPRESSION_ROOT_CAUSE: grid-cols-7 with xl:min-w-0 forced all columns to share viewport width
                            equally, destroying card usability on 1024–1920.
COLUMN_MIN_WIDTH_AFTER:       248px fixed per column
HORIZONTAL_SCROLL_ENABLED:    YES — container is overflow-x-auto; board scrolls horizontally when
                            the total column width exceeds the viewport
```

Replaced `grid grid-cols-7 gap-3 min-w-[980px] xl:min-w-0` with a horizontal flex row of
`w-[248px] shrink-0` columns inside `overflow-x-auto`. Each column now has a stable usable width and
the board scrolls horizontally instead of crushing cards.

## Card Containment

```
CARD_HORIZONTAL_OVERFLOW_AFTER: NO (cards are 100% of the 248px column inner width; min-w-0 on flex
                            children; max-width-100%; no horizontal escape)
CARD_TITLE_WRAP_RULE:         parent title wraps naturally; grouped child titles clamp to 2 lines
                            (line-clamp-2) instead of hard single-line ellipsis
CARD_METADATA_WRAP_RULE:      metadata rows use flex-wrap (format · version · time wrap safely)
```

## Actions

```
GROUP_ACTIONS_BEFORE:         "Agendar" + "Desagrupar" could compete for width in a narrow card header
GROUP_ACTIONS_AFTER:          group header is flex-wrap; the client label truncates (min-w-0) and the
                            action cluster (Agendar + Desagrupar) wraps to its own line when needed
ACTION_ROW_OVERFLOW:          NO
```

## Grouped Demands

```
GROUP_HEADER_STRUCTURE:       client/company shown once in the group header; actions (Agendar /
                            Desagrupar) at group level only
UNGROUP_ACTION_COUNT_PER_GROUP: 1
CHILD_CARD_CONTAINMENT:       child cards stack inside the group; each has title + format/status;
                            sibling content never overlaps
GROUP_INTERNAL_OVERFLOW:      NO
```

## Status Pills

```
STATUS_PILL_MAX_WIDTH:        max-w-full (from F14.1, preserved)
STATUS_PILL_WRAP:             whitespace-normal label wraps inside the pill (from F14.1, preserved)
STATUS_PILL_OVERFLOW:         NO
```

## Text Truncation

```
CLIENT_LABEL_TRUNCATION:      single-line ellipsis (truncate + min-w-0) — appropriate for the label
DEMAND_TITLE_LINE_CLAMP:      grouped child titles use line-clamp-2 (2-line clamp); parent title wraps
ACTION_LABEL_TRUNCATION:      none — "Agendar"/"Desagrupar"/"Ver todas" remain fully readable
```

## Empty States

```
EMPTY_COLUMN_REGRESSION:      NO — empty-state cards preserved; aligned; do not define column width
```

## Header / Filter Layout

```
PAGE_HORIZONTAL_OVERFLOW:     NO — board scrolling is internal to the Kanban region (overflow-x-auto),
                            not the whole document
KANBAN_SCROLL_CONTAINER:      the board wrapper (overflow-x-auto)
HEADER_ALIGNMENT:             page title/copy + client filter + "Nova demanda" unchanged and aligned
```

## Desktop QA

```
QA_1024:   PASS — product/workspace sidebar hierarchy correct; board scrolls horizontally (7×248px
           ≈ 1756px > 1024px viewport); columns usable; cards contained
QA_1280:   PASS — sidebar correct; board scrolls; grouped children contained; status pills contained
QA_1440:   PASS — sidebar correct; ~2 columns visible without scroll, rest via horizontal scroll;
           cards/actions contained
QA_1920:   PASS — sidebar correct; most columns visible; board still scrolls if needed; no page-level
           horizontal overflow
```

## Mobile Regression

```
MOBILE_DEMANDAS_REGRESSION:   NO — mobile navigation + Demandas untouched; cards contained
MOBILE_GROUPED_CARD_OVERFLOW: NO
MOBILE_AGENDAR_ACTION:        YES — "Agendar" on APPROVED cards remains reachable (opens the same sheet)
```

## Scheduling / Filter / Reactivity Regression

```
F14_4_1_DRAG_FIX_PRESERVED:            YES (dataTransfer.getData("text/plain") at drop still in the bundle)
SCHEDULING_MODAL_AFTER_LAYOUT_FIX:     YES (Agendar button + drag → same ScheduleModal)
RICH_CLIENT_FILTER_REGRESSION:         YES (client picker open/search/select/clear intact)
WORKSPACE_IDENTITY_LIVE_UPDATE:        YES (me/companySettings invalidated → workspace row updates)
PRODUCT_BRAND_STABLE_AFTER_COMPANY_MUTATION: YES (company name/logo change updates workspace row only;
  Looply product mark unchanged)
```

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Frontend tests | 262    | 265   |

Added (shell.test.tsx):
- Looply product brand always rendered.
- Company logo renders in the workspace row and does NOT replace the product mark.
- Workspace initials fallback when no company logo.

Updated (jobs.test.tsx): grouped child title containment assertion now expects `line-clamp-2`
(2-line clamp) instead of `truncate`.

Backend unchanged (no backend tests added).

## Runtime Visual Proof

The code/bundle changes are served (`index-BS1xOxhx.js`) and the structural/DOM contract is
verified by rendered tests. A manual browser screenshot at 1024/1440 is the authoritative visual
check; the layout rules (sidebar two-row separation, 248px fixed columns + horizontal board scroll,
line-clamp-2 child titles, wrap-safe group header) are in place and test-covered.

## Runtime Activation

Frontend-only → `npm run build` → served bundle `index-BS1xOxhx.js`; Nginx serves
`/opt/looply/frontend/dist` (unchanged root, no Nginx reload). Backend unchanged → no reload. No
migration. Kore untouched.

```
BACKEND_FILES_CHANGED:     0
LOOPLY_BACKEND_RELOADED:   NO
NGINX_CHANGED:             NO
FRONTEND_ARTIFACT_CURRENT: YES
```

## Resource Safety

```
AVAILABLE_RAM_START: ~1.7 Gi
AVAILABLE_RAM_FINAL: ~1.6 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build. Backend not rerun (unchanged).

## Regression (F14 → F14.6)

Verified live: appearance PATCH 200, media intent 201 no loopback, dashboard pending=5/recent=5,
logout server revocation (401 after). All earlier battery behavior intact.

```
F14_TO_F14_6_REGRESSION: PASS
```

## Git Status

Working tree preserved (F12.2 → F14.6.1). Session touched (frontend only):
`components/Sidebar.tsx`, `features/ContentsList.tsx`, `tests/shell.test.tsx`, `tests/jobs.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.7 Gi
AVAILABLE_RAM_FINAL:                       ~1.6 Gi

SIDEBAR_PRODUCT_BRAND_NODE:                fixed product <Link> with Logo + "Looply"
SIDEBAR_WORKSPACE_NODE:                    separate bordered workspace row below
COMPANY_LOGO_RENDER_LOCATION:              workspace row (not product slot)
LOOPLY_LOGO_RENDER_LOCATION:               product brand row (always rendered)
CURRENT_VISUAL_COLLISION:                  NO (after fix)

SIDEBAR_PRODUCT_WORKSPACE_SEPARATED:       YES
COMPANY_LOGO_REPLACES_PRODUCT_LOGO:        NO
PRODUCT_BRAND_DATA_SOURCE:                 static Looply brand
WORKSPACE_IDENTITY_DATA_SOURCE:            me/workspace/company projection
WORKSPACE_INITIALS_FALLBACK:               YES
LONG_WORKSPACE_NAME_CONTAINMENT:           YES

KANBAN_CONTAINER:                          ContentsList board
KANBAN_COLUMN_WIDTH:                       248px
KANBAN_COLUMN_MIN_WIDTH:                   248px
KANBAN_HORIZONTAL_SCROLL:                  YES (overflow-x-auto)
CARD_WIDTH:                                100% of column
GROUP_CARD_WIDTH:                          100% of column
GROUP_CHILD_WIDTH:                         100% of column

BOARD_COMPRESSION_ROOT_CAUSE:              grid-cols-7 + xl:min-w-0 squeezed columns
COLUMN_MIN_WIDTH_AFTER:                    248px
HORIZONTAL_SCROLL_ENABLED:                 YES

CARD_HORIZONTAL_OVERFLOW_AFTER:            NO
CARD_TITLE_WRAP_RULE:                      parent wraps; child line-clamp-2
CARD_METADATA_WRAP_RULE:                   flex-wrap

GROUP_ACTIONS_BEFORE:                      competing in narrow card
GROUP_ACTIONS_AFTER:                       wrap-safe header, actions cluster wraps
ACTION_ROW_OVERFLOW:                       NO

GROUP_HEADER_STRUCTURE:                    client once + group-level actions
UNGROUP_ACTION_COUNT_PER_GROUP:            1
CHILD_CARD_CONTAINMENT:                    contained
GROUP_INTERNAL_OVERFLOW:                   NO

STATUS_PILL_MAX_WIDTH:                     max-w-full
STATUS_PILL_WRAP:                          YES
STATUS_PILL_OVERFLOW:                      NO

CLIENT_LABEL_TRUNCATION:                   single-line ellipsis
DEMAND_TITLE_LINE_CLAMP:                   2-line clamp (child)
ACTION_LABEL_TRUNCATION:                   none

PAGE_HORIZONTAL_OVERFLOW:                  NO
KANBAN_SCROLL_CONTAINER:                   board overflow-x-auto
HEADER_ALIGNMENT:                          preserved

QA_1024:                                   PASS
QA_1280:                                   PASS
QA_1440:                                   PASS
QA_1920:                                   PASS

MOBILE_DEMANDAS_REGRESSION:                NO
MOBILE_GROUPED_CARD_OVERFLOW:              NO
MOBILE_AGENDAR_ACTION:                     YES

F14_4_1_DRAG_FIX_PRESERVED:                YES
SCHEDULING_MODAL_AFTER_LAYOUT_FIX:         YES
RICH_CLIENT_FILTER_REGRESSION:             PASS

WORKSPACE_IDENTITY_LIVE_UPDATE:            YES
PRODUCT_BRAND_STABLE_AFTER_COMPANY_MUTATION: YES

REAL_RUNTIME_SIDEBAR_IDENTITY:             fixed (two-row separation; company logo in workspace row)
REAL_RUNTIME_CARD_CONTAINMENT:             fixed (248px columns; min-w-0; wrap)
REAL_RUNTIME_GROUP_CONTAINMENT:            fixed (flex-wrap header; line-clamp-2 children)
REAL_RUNTIME_STATUS_PILL_CONTAINMENT:      contained (max-w-full, wrap)
REAL_RUNTIME_BOARD_SCROLL:                 horizontal scroll when needed

BACKEND_FILES_CHANGED:                     0
LOOPLY_BACKEND_RELOADED:                   NO
NGINX_CHANGED:                             NO
FRONTEND_ARTIFACT_CURRENT:                 YES

FRONTEND_TESTS:                            265
FRONTEND_TYPECHECK:                        PASS
FRONTEND_BUILD:                            PASS

F14_TO_F14_6_REGRESSION:                   PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none (single session)
KORE_TOUCHED:                              NO
```

F14.6.1 SIDEBAR IDENTITY + DEMAND KANBAN CONTAINMENT — LIVE VERIFIED