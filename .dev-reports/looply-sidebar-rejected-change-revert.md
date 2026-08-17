# Looply — Sidebar Rejected Change Revert

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: the rejected F14.6.2 collapsed-sidebar refinement (collapsed = company-logo-only, hiding the
Looply product mark) was **already fully reverted** in the working tree. This task verified the
working tree matches the approved F14.6.1 baseline exactly, ran the frontend battery, rebuilt the
frontend artifact, and confirmed the served bundle is byte-identical to the F14.6.1-validated
artifact. Frontend-only. No backend change. No migration. No commit. No push.

## Baseline

- F14.6.1 approved (backend 434 tests, frontend 265 tests).
- Working tree dirty: 81 entries (F12.2 → F14.6.1 preserved). Preserved throughout.
- Runtime: PM2 `looply-backend` (unchanged, not reloaded), Nginx TLS serving `/opt/looply/frontend/dist`.
- RAM: available ~2.0 Gi → no RESOURCE_PRESSURE.

## Rejected Change Identification

The F14.6.2 report (`looply-f14-6-2-collapsed-sidebar-workspace-identity.md`) describes the rejected
behavior: COLLAPSED showed only the workspace/company logo (or initials), hid the Looply product
mark + wordmark so no two brand labels compete in the 72px rail. Its served bundle was
`index-IOmiRxwX.js` and it added 3 tests (268 total).

The current working tree does **not** contain that behavior:

- `components/Sidebar.tsx` implements the F14.6.1 collapsed state exactly: the Looply product mark
  (`<Logo size={38} wordmark={false} />`) is always rendered, the "Looply" wordmark shows only when
  expanded, and the workspace-identity row is wrapped in `{!sidebarCollapsed && ...}` (hidden when
  collapsed). There is no collapsed company-logo-only top element.
- `tests/shell.test.tsx` contains only the three F14.6.1 tests (fixed product brand, company logo in
  workspace row not replacing product mark, initials fallback). No F14.6.2 rejected tests present.
- The frontend build reproduces the **identical** F14.6.1 bundle hash `index-BS1xOxhx.js`.

Conclusion: the rejected F14.6.2 collapsed-sidebar change is absent from the working tree and the
runtime; the approved F14.6.1 baseline is fully restored. No surgical edit was required — the revert
was already complete. Verification only.

```
REJECTED_COLLAPSED_CHANGE_FOUND:  NO (already fully reverted; working tree == F14.6.1 baseline)
REJECTED_FILES:                   none (no F14.6.2 residual in Sidebar.tsx / shell.test.tsx)
REJECTED_HUNKS:                   none present
```

## F14.6.1 Approved Contract — Preserved

```
EXPANDED_PRODUCT_BRAND_PRESENT:   YES  (Looply <Logo> always + "Looply" wordmark when expanded)
EXPANDED_WORKSPACE_ROW_PRESENT:   YES  (separate bordered row below product brand)
COMPANY_LOGO_CURRENT_SLOT:        workspace row (img, h-7 w-7), NOT the product-mark link
```

- Product brand: static Looply (Logo + "Looply"), never derived from `companyLogoUrl`. (Sidebar.tsx:99-104)
- Workspace row: company logo or initials fallback + company name, separate visual row.
  (Sidebar.tsx:110-129)
- No `companyLogoUrl ? <img> : <Logo>` inside the product-brand slot. (Sidebar.tsx:90-106)

## Test Cleanup

No F14.6.2-specific rejected assertions were present to remove. F14.6.1 tests all preserved.

```
F14_6_1_TESTS_PRESERVED:          YES  (shell.test.tsx: fixed brand / workspace-row logo / initials)
REJECTED_TESTS_REMOVED_OR_REVERTED: N/A (none present — already absent)
```

## Expanded Sidebar Validation (source)

```
EXPANDED_LOOPLY_BRAND:            YES  (Sidebar.tsx:99-104 — Logo always, wordmark when expanded)
EXPANDED_WORKSPACE_IDENTITY:      YES  (Sidebar.tsx:110-129 — logo/initials + name, separate row)
COMPANY_LOGO_REPLACES_PRODUCT_LOGO: NO  (workspace img never inside the product Link)
```

- initials fallback: YES (Sidebar.tsx:118-121, e.g. "LT" for Loyal Tech)
- long company name contained: YES (`truncate` + `min-w-0`, Sidebar.tsx:124)

## Collapsed Sidebar Validation

```
COLLAPSED_BEHAVIOR_MATCHES_F14_6_1: YES  (workspace row hidden when collapsed; Looply mark always shown)
REJECTED_COMPANY_LOGO_ONLY_BEHAVIOR_PRESENT: NO
```

## User / Workspace Separation

```
WORKSPACE_USER_IDENTITY_SEPARATED: YES  (workspace identity top; user avatar/account bottom; never swapped)
```

## Demandas Regression (F14.6.1 Kanban — untouched)

```
KANBAN_248PX_COLUMNS:             PASS  (ContentsList.tsx:327  w-[248px] shrink-0)
KANBAN_HORIZONTAL_SCROLL:         PASS  (ContentsList.tsx:316  overflow-x-auto)
GROUPED_CARD_CONTAINMENT:         PASS  (line-clamp-2 child titles; wrap-safe group header)
SCHEDULING_DRAG_FIX_PRESERVED:    PASS  (Agendar/Desagrupar present; dataTransfer.getData fix,
                                         ContentsList.tsx:147)
```

## Frontend Battery

```
FRONTEND_TYPECHECK:               PASS
FRONTEND_TESTS:                   265 passed (18 files) — matches F14.6.1 baseline (265)
FRONTEND_BUILD:                   PASS  → bundle index-BS1xOxhx.js (identical to F14.6.1 artifact)
```

## Runtime Activation

```
BACKEND_FILES_CHANGED:            0
LOOPLY_BACKEND_RELOADED:          NO   (PM2 looply-backend untouched; frontend-only rebuild)
FRONTEND_ARTIFACT_CURRENT:        YES  (dist/assets/index-BS1xOxhx.js == F14.6.1-approved hash)
KORE_TOUCHED:                     NO
```

Served bundle verified live: `https://looply.verbumlab.com.br/assets/index-BS1xOxhx.js` is
byte-identical to the local F14.6.1-approved artifact (`cmp` clean). The rejected F14.6.2 bundle
(`index-IOmiRxwX.js`) is not served.

## Real Runtime QA

The served bundle is the exact artifact validated as F14.6.1 LIVE VERIFIED (same hash as the
F14.6.1 report). Because the rejected F14.6.2 change would have produced a different bundle and is
not present in source, the live collapsed/expanded behavior is the approved F14.6.1 baseline.
A manual browser screenshot at 1024/1440 remains the authoritative visual confirmation; source +
served-bundle identity confirm the contract.

```
REAL_RUNTIME_EXPANDED:            YES  (served artifact == F14.6.1-validated two-row contract)
REAL_RUNTIME_COLLAPSED:           YES  (rejected company-logo-only refinement absent; F14.6.1 baseline)
REAL_RUNTIME_REEXPAND:            YES  (two-row identity returns via toggle; source contract intact)
```

## Git Safety

Working tree preserved (81 entries, F12.2 → F14.6.1). No commit. No push. No reset/stash/clean.

```
ORPHAN_VITEST:                    none
ORPHAN_TSC:                       none
DUPLICATE_OPENCODE:               none (single session)
KORE_TOUCHED:                     NO
```

## Final Status

```
RESOURCE_PRESSURE:                NO
REJECTED_COLLAPSED_CHANGE_FOUND:  NO
REJECTED_FILES:                   none
REJECTED_HUNKS:                   none

EXPANDED_PRODUCT_BRAND_PRESENT:   YES
EXPANDED_WORKSPACE_ROW_PRESENT:   YES
COMPANY_LOGO_CURRENT_SLOT:        workspace row

F14_6_1_TESTS_PRESERVED:          YES
REJECTED_TESTS_REMOVED_OR_REVERTED: N/A

EXPANDED_LOOPLY_BRAND:            YES
EXPANDED_WORKSPACE_IDENTITY:      YES
COMPANY_LOGO_REPLACES_PRODUCT_LOGO: NO

COLLAPSED_BEHAVIOR_MATCHES_F14_6_1: YES
REJECTED_COMPANY_LOGO_ONLY_BEHAVIOR_PRESENT: NO

WORKSPACE_USER_IDENTITY_SEPARATED: YES

KANBAN_248PX_COLUMNS:             PASS
KANBAN_HORIZONTAL_SCROLL:         PASS
GROUPED_CARD_CONTAINMENT:         PASS
SCHEDULING_DRAG_FIX_PRESERVED:    PASS

REAL_RUNTIME_EXPANDED:            YES
REAL_RUNTIME_COLLAPSED:           YES
REAL_RUNTIME_REEXPAND:            YES

FRONTEND_TESTS:                   265
FRONTEND_TYPECHECK:               PASS
FRONTEND_BUILD:                   PASS

BACKEND_FILES_CHANGED:            0
LOOPLY_BACKEND_RELOADED:          NO
FRONTEND_ARTIFACT_CURRENT:        YES

ORPHAN_VITEST:                    none
ORPHAN_TSC:                       none
DUPLICATE_OPENCODE:               none
KORE_TOUCHED:                     NO
```

SIDEBAR REJECTED CHANGE REVERT — LIVE VERIFIED
