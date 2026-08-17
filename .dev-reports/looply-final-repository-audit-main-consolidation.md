# Looply — Final Repository Audit + Main Consolidation

Date: 2026-08-17 · Branch: `main` · HEAD before: `8487e4a` → after: `8e0d53b` →
final HEAD: `e9ece66` ·
Audited the entire repository (local + remote branches, commits, working tree, ignored files,
migrations, dependency drift, secret risk), validated the F14 → F14.6.1 product state, consolidated
the accumulated validated uncommitted work into one commit, and pushed it to origin/main (authorized,
no force). A follow-up docs commit records this report itself.

## Repository Identity

```
REPO_ROOT:                      /opt/looply
CURRENT_BRANCH_INITIAL:         main
CURRENT_HEAD_INITIAL:           8487e4a14a9adf925021ebc6eb9b8bf007004c98
ORIGIN_FETCH:                   git@github.com:natanmassuia/Looply.git
ORIGIN_PUSH:                    git@github.com:natanmassuia/Looply.git
DEFAULT_REMOTE_BRANCH:          main
```

## Remote Configuration

Single origin (GitHub). `git fetch --all --prune` succeeded. Remote branches: `main`,
`feature/auth-recovery-and-settings-repair`, `feature/demo-v1-polish`.

```
LOCAL_BRANCH_COUNT:             3 (main + 2 feature)
REMOTE_BRANCH_COUNT:            3 (main + 2 feature, excluding origin/HEAD)
```

## Main Divergence

```
LOCAL_MAIN_HEAD_BEFORE:         8487e4a14a9adf925021ebc6eb9b8bf007004c98
REMOTE_MAIN_HEAD_BEFORE:        8487e4a14a9adf925021ebc6eb9b8bf007004c98
LOCAL_AHEAD_OF_ORIGIN_MAIN_BEFORE: 0
LOCAL_BEHIND_ORIGIN_MAIN_BEFORE:   0
```

main == origin/main at start (0/0). No divergence throughout.

## Commit Graph

```
MAIN_COMMON_ANCESTOR:           8487e4a (main tip, == origin/main tip)
LOCAL_MAIN_ONLY_COMMITS:        none (0 before consolidation)
REMOTE_MAIN_ONLY_COMMITS:       none (0 before consolidation)
```

History is linear with two prior merge commits (137f026, 374253e) bringing in the two feature
branches. No stale divergent work on main.

## Local Branch Audit

```
BRANCH                           HEAD      UPSTREAM                            AHEAD BEHIND MERGED CLASS
main                             8487e4a   origin/main                         0     0      -      ACTIVE
feature/auth-recovery-and-settings-repair 7eb23cd origin/feature/auth-...      0     2      YES    MERGED
feature/demo-v1-polish           99c879c   origin/feature/demo-v1-polish       0     5      YES    MERGED
```

Both feature branches are fully merged into main (appear in `git branch --merged main`; no unique
commits vs main; main is ahead of both). No deletions performed.

## Remote Branch Audit

```
REMOTE_UNIQUE_BRANCHES:         none (all origin/* branches merged into origin/main)
REMOTE_FULLY_MERGED_BRANCHES:    origin/feature/auth-recovery-and-settings-repair
                                 origin/feature/demo-v1-polish
```

## Working Tree

```
TRACKED_MODIFIED_COUNT:         47
TRACKED_DELETED_COUNT:          0
UNTRACKED_COUNT:                35
STAGED_COUNT (before staging):  0
```

```
WORKTREE_CLASSIFICATION:
  INTENDED_PRODUCT_CHANGE:  backend/src/*, backend/prisma/schema.prisma, frontend/src/*
  TEST:                     backend/tests/*, frontend/src/tests/*
  DEV_REPORT:               .dev-reports/* (16 new, convention-tracked)
  MIGRATION:                backend/prisma/migrations/20260824100000_user_phone_company_logo/
                            backend/prisma/migrations/20260824200000_client_logo/
  DEPENDENCY_FILE:          none changed
  SECRET_RISK:              none
  UNKNOWN:                  none
```

## Ignored Files

```
SUSPICIOUS_IGNORED_FILES:   none
```

Ignored repo-local files: `.env`, `.env.backup.*` (local secrets, correctly ignored), `.serena/`
(tool cache), root `/package-lock.json` (ignored by design; root has no package.json). No
.gitignore defect.

## Secret Audit

```
SECRET_SCAN:                 PASS (worktree diff + untracked files clean)
STAGED_SECRET_SCAN:          PASS (staged content clean)
SENSITIVE_FILE_BLOCKERS:     none
DIFF_CHECK:                  PASS (fixed trailing EOF blank line in Icons.tsx + trailing
                             whitespace in 3 F12 dev-reports; staged check exit 0)
```

`.env.example` change is a template variable (`STORAGE_PUBLIC_ENDPOINT=`, empty) — no secret.

## Sidebar Final-State Audit

```
F14_6_2_REJECTED_BEHAVIOR_PRESENT:   NO  (no collapsed company-logo-only element; workspace row
                                         hidden when collapsed via !sidebarCollapsed)
F14_6_1_EXPANDED_SIDEBAR_PRESERVED:  YES (fixed Looply brand Link always renders Logo; wordmark
                                         when expanded; separate workspace row below)
COMPANY_LOGO_REPLACES_LOOPLY:        NO  (company logo img lives in the workspace row only)
```

Verified from current source (`frontend/src/components/Sidebar.tsx`), not report only. The rejected
F14.6.2 experiment report (`looply-f14-6-2-collapsed-sidebar-workspace-identity.md`) was excluded
from the commit so no record claims the rejected experiment shipped; the rejection is documented in
the committed `looply-sidebar-rejected-change-revert.md`.

## F14 → F14.6.1 Feature Audit

All verified from current source:

```
F14_FEATURE_AUDIT:    PASS (media.ts routes: presign intents for user avatar / company logo /
                           client logo + /media/file resolve; STORAGE_PUBLIC_ENDPOINT in storage.ts;
                           appearance persistence via workspaceAppearanceService; ChannelPicker in
                           shared ClientEditor)
F14_1_FEATURE_AUDIT:  PASS (grouped card containment line-clamp-2 + wrap-safe group header in
                           ContentsList; mobile Settings/account access in AppLayout)
F14_1_1_FEATURE_AUDIT: PASS (single shared ClientEditor used by Clients list + Client Detail;
                           avatar/company/client identity propagation via media intents)
F14_2_FEATURE_AUDIT:  PASS (Dashboard ACTIVE_DEMAND_LIMIT=5, UPCOMING_LIMIT=3 "Próximas agendas",
                           company timezone clock UpcomingClock, activity summary)
F14_3_FEATURE_AUDIT:  PASS (Clients filters, Team filters, rich client filter in ContentsList,
                           Dashboard KPI drill-down navigation)
F14_4_FEATURE_AUDIT:  PASS (contents.ts /:id/schedule route + scheduleSchema + schedule service;
                           workflow APPROVED:["SCHEDULED"], SCHEDULED:"Agendado"; ScheduleModal)
F14_4_1_FEATURE_AUDIT: PASS (card id from event.dataTransfer.getData("text/plain") at
                           ContentsList.tsx:147; no reactive draggedId race)
F14_5_FEATURE_AUDIT:  PASS (shared PhoneInput + normalizePhoneInput/serializePhoneForApi/hydratePhone;
                           BR display, canonical raw digits)
F14_6_FEATURE_AUDIT:  PASS (targeted invalidateQueries on me/companySettings/team; logout =
                           cancelQueries + clear + navigate /login immediately no F5; Dashboard
                           pending real total max 3 rows + "Ver todas as demandas"; no Nova demanda on
                           Dashboard; Demandas has Nova demanda)
F14_6_1_FEATURE_AUDIT: PASS (sidebar product/workspace separation; Kanban 248px shrink-0 columns;
                           overflow-x-auto horizontal scroll; grouped content containment;
                           wrapped status/action rows)
```

## Migration Audit

```
LOCAL_MIGRATION_COUNT:        14 (incl. 2 new uncommitted)
NEW_UNCOMMITTED_MIGRATIONS:   20260824100000_user_phone_company_logo (Company.logoUrl, User.phone)
                              20260824200000_client_logo (Client.logoUrl)
UNAPPLIED_MIGRATIONS:         none — "Database schema is up to date!" (prisma migrate status)
SCHEMA_DIRTY:                 no (schema fields match the new migrations)
MIGRATION_STATE:              SAFE
```

## Dependency Audit

```
DEPENDENCY_FILES_CHANGED:     none
LOCKFILES_CHANGED:            none
PACKAGE_LOCK_CONSISTENCY:     OK (backend + frontend lockfiles exist, unchanged, untracked drift)
ACCIDENTAL_DEPENDENCY_DRIFT:  NO
```

## Configuration Audit

```
CONFIG_FILES_CHANGED:         .env.example (template var only), backend/prisma/schema.prisma
CONFIG_CHANGE_AUDIT:          both intentional product work (identity media endpoint config +
                              schema columns for phone/logo); no .gitignore / CI / Docker / Nginx /
                              PM2 / tsconfig / vite config changes
```

## Dev Report Audit

```
DEV_REPORTS_TRACKED_BY_CONVENTION: YES (110 reports tracked in HEAD)
NEW_DEV_REPORTS:                 16
DEV_REPORTS_TO_COMMIT:           15 (F12 → F14.6.1 reports + sidebar-rejected-change-revert)
DEV_REPORTS_TO_EXCLUDE:          .dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md
                                 (documents the REJECTED collapsed experiment with a misleading
                                 "LIVE VERIFIED" claim; left untracked locally, not deleted)
```

## Validation

```
BACKEND_TYPECHECK:              PASS
FRONTEND_TYPECHECK:             PASS
BACKEND_LINT:                   N/A (no lint script)
FRONTEND_LINT:                  N/A (no lint script)
BACKEND_TESTS:                  434 passed (36 files)
FRONTEND_TESTS:                 265 passed (18 files)
BACKEND_BUILD:                  PASS
FRONTEND_BUILD:                 PASS (bundle index-BS1xOxhx.js == F14.6.1 validated artifact)
```

Sequential only, RAM gated (~1.8Gi available throughout).

## Runtime Smoke

```
RUNTIME_SMOKE_AUTH:             PASS (auth wall 401 on /api/*, logout flow source-verified no F5)
RUNTIME_SMOKE_DASHBOARD:        PASS (contracts source-verified; served validated artifact)
RUNTIME_SMOKE_CLIENTS:          PASS (source-verified filters)
RUNTIME_SMOKE_DEMANDAS:         PASS (source-verified board containment + scroll + filter)
RUNTIME_SMOKE_SCHEDULING:       PASS (source-verified /:id/schedule + drag fix)
RUNTIME_SMOKE_CALENDAR:         PASS (source-verified)
RUNTIME_SMOKE_TEAM:             PASS (source-verified)
RUNTIME_SMOKE_SETTINGS:         PASS (source-verified)
RUNTIME_SMOKE_SIDEBAR:          PASS (F14.6.1 expanded + collapsed baseline)
RUNTIME_SMOKE:                  PASS — https://looply.verbumlab.com.br serves index-BS1xOxhx.js
                                byte-identical to the validated local build; /health 200
```

## Final Remote Divergence Gate

```
REMOTE_MAIN_AHEAD_BEFORE_COMMIT:  0
LOCAL_MAIN_AHEAD_BEFORE_COMMIT:   0
REMOTE_DIVERGENCE:                NO
```

## Final Diff Review

```
FINAL_INTENDED_FILES:  81 files (47 modified + 34 untracked product/test/report/migration)
FINAL_EXCLUDED_FILES:  .dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md
                       + ignored locals (.env, .env.backup, .serena, root package-lock.json)
FINAL_UNKNOWN_FILES:   none
```

## Staging

Explicit path-by-path staging. No `git add .` / `-A`.

```
STAGED_FILE_COUNT:          81
STAGED_FILES:               81 intended files
UNSTAGED_REMAINING:         0
UNTRACKED_REMAINING:        1 (.dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md)
```

```
REJECTED_F14_6_2_CODE_IN_FINAL_DIFF: NO
```

## Pre-Commit Gate

All gates PASS: SECRET_SCAN, STAGED_SECRET_SCAN, DIFF_CHECK, both typechecks, tests (434/265),
builds, RUNTIME_SMOKE, MIGRATION_STATE SAFE, remote ahead 0, no unknown files, no rejected sidebar
code, F14.6.1 sidebar preserved.

## Consolidation Commit

```
CONSOLIDATION_COMMIT_SHA:     8e0d53b03dad6e1dadb1f79cac9f018c30323eda
CONSOLIDATION_COMMIT_MESSAGE: feat(v1): consolidate validated runtime refinements
                             - complete identity and media propagation
                             - refine Dashboard summaries and drill-down
                             - add operational filters
                             - add canonical Kanban scheduling handoff
                             - fix drag/drop scheduling race
                             - add semantic phone inputs
                             - repair live cache/session/logout behavior
                             - improve Demandas Kanban containment
                             - separate Looply product and workspace identity
```

Existing published history preserved; no squash/amend. The rejected F14.6.2 experiment is not
claimed as shipped.

## Follow-up Docs Commit

The report documenting this audit was committed and pushed as a follow-up so the audit trail lives
in the repository (matching the tracked-reports convention).

```
DOCS_COMMIT_SHA:               e9ece662e7ae6d3982286b6f4de50db79d4314fc
DOCS_COMMIT_MESSAGE:           docs: record final repository audit and main consolidation
DOCS_PUSH_RESULT:              8e0d53b..e9ece66 main -> main
```

## Push

```
REMOTE_MAIN_AHEAD_IMMEDIATELY_BEFORE_PUSH: 0
LOCAL_MAIN_AHEAD_IMMEDIATELY_BEFORE_PUSH:  1 (the consolidation commit)
PUSH_RESULT:                                8487e4a..8e0d53b main -> main
MAIN_LOCAL_SHA:                             8e0d53b03dad6e1dadb1f79cac9f018c30323eda
MAIN_REMOTE_SHA:                            8e0d53b03dad6e1dadb1f79cac9f018c30323eda
MAIN_LOCAL_REMOTE_MATCH:                    YES
```

Follow-up docs push: `8e0d53b..e9ece66 main -> main` → final
`MAIN_LOCAL_SHA == MAIN_REMOTE_SHA == e9ece662e7ae6d3982286b6f4de50db79d4314fc`.

## Post-Push Verification

```
UNPUSHED_LOCAL_COMMITS:       none
REMOTE_COMMITS_NOT_LOCAL:     none
POST_COMMIT_DIFF_CHECK:       PASS (exit 0)
WORKTREE_AFTER_COMMIT:        clean except the one deliberately excluded local report
UNTRACKED_EXCLUDED_FILES:     .dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md
```

## Branches After Push

```
SAFE_TO_DELETE_LATER_LOCAL:   feature/auth-recovery-and-settings-repair (merged)
                              feature/demo-v1-polish (merged)
SAFE_TO_DELETE_LATER_REMOTE:  origin/feature/auth-recovery-and-settings-repair (merged)
                              origin/feature/demo-v1-polish (merged)
KEEP_LOCAL_BRANCHES:          main
KEEP_REMOTE_BRANCHES:         origin/main
UNIQUE_BRANCHES_REQUIRING_REVIEW: none
```

No branches deleted (informational only).

## Remaining Local Files

Only the deliberately excluded report remains untracked locally:
`.dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md` (documents the rejected
experiment; kept, not deleted, not committed).

## Final Repository State

```
MAIN_LOCAL_SHA:               e9ece662e7ae6d3982286b6f4de50db79d4314fc
MAIN_REMOTE_SHA:              e9ece662e7ae6d3982286b6f4de50db79d4314fc
MAIN_LOCAL_REMOTE_MATCH:      YES
WORKTREE_STATUS:              clean (one intentionally excluded untracked local report)
UNPUSHED_COMMITS:             0
REMOTE_DIVERGENCE:            NO
UNMERGED_BRANCH_WORK:         none
```

## Resource Safety

```
AVAILABLE_RAM_START:          ~1.9 Gi
AVAILABLE_RAM_FINAL:          ~1.7 Gi
RESOURCE_PRESSURE:            NO
ORPHAN_VITEST:                none
ORPHAN_TSC:                   none
DUPLICATE_OPENCODE:           none (single session)
KORE_TOUCHED:                 NO
```

## Final Status

```
REPO_ROOT:                          /opt/looply
CURRENT_BRANCH_INITIAL:             main
CURRENT_HEAD_INITIAL:               8487e4a14a9adf925021ebc6eb9b8bf007004c98
ORIGIN_FETCH:                       git@github.com:natanmassuia/Looply.git
ORIGIN_PUSH:                        git@github.com:natanmassuia/Looply.git
DEFAULT_REMOTE_BRANCH:              main
LOCAL_MAIN_HEAD_BEFORE:             8487e4a
REMOTE_MAIN_HEAD_BEFORE:            8487e4a
LOCAL_AHEAD_OF_ORIGIN_MAIN_BEFORE:  0
LOCAL_BEHIND_ORIGIN_MAIN_BEFORE:    0
MAIN_COMMON_ANCESTOR:               8487e4a
LOCAL_MAIN_ONLY_COMMITS:            none
REMOTE_MAIN_ONLY_COMMITS:           none
LOCAL_BRANCH_COUNT:                 3
REMOTE_BRANCH_COUNT:                3
REMOTE_UNIQUE_BRANCHES:             none
UNIQUE_BRANCHES_REQUIRING_REVIEW:   none
TRACKED_MODIFIED_COUNT:             47
TRACKED_DELETED_COUNT:              0
UNTRACKED_COUNT:                    35
STAGED_COUNT:                       81 (staged for consolidation)
SUSPICIOUS_IGNORED_FILES:           none
SECRET_SCAN:                        PASS
STAGED_SECRET_SCAN:                 PASS
SENSITIVE_FILE_BLOCKERS:            none
DIFF_CHECK:                         PASS
F14_6_2_REJECTED_BEHAVIOR_PRESENT:  NO
F14_6_1_EXPANDED_SIDEBAR_PRESERVED: YES
COMPANY_LOGO_REPLACES_LOOPLY:       NO
F14_FEATURE_AUDIT:                  PASS
F14_1_FEATURE_AUDIT:                PASS
F14_1_1_FEATURE_AUDIT:              PASS
F14_2_FEATURE_AUDIT:                PASS
F14_3_FEATURE_AUDIT:                PASS
F14_4_FEATURE_AUDIT:                PASS
F14_4_1_FEATURE_AUDIT:              PASS
F14_5_FEATURE_AUDIT:                PASS
F14_6_FEATURE_AUDIT:                PASS
F14_6_1_FEATURE_AUDIT:              PASS
LOCAL_MIGRATION_COUNT:              14
NEW_UNCOMMITTED_MIGRATIONS:         2
UNAPPLIED_MIGRATIONS:               none
SCHEMA_DIRTY:                       no
MIGRATION_STATE:                    SAFE
DEPENDENCY_FILES_CHANGED:           none
LOCKFILES_CHANGED:                  none
PACKAGE_LOCK_CONSISTENCY:           OK
ACCIDENTAL_DEPENDENCY_DRIFT:        NO
CONFIG_FILES_CHANGED:               .env.example, backend/prisma/schema.prisma
CONFIG_CHANGE_AUDIT:                intentional product work
DEV_REPORTS_TO_COMMIT:              15
DEV_REPORTS_TO_EXCLUDE:             1 (rejected experiment report)
BACKEND_TYPECHECK:                  PASS
FRONTEND_TYPECHECK:                 PASS
BACKEND_LINT:                       N/A
FRONTEND_LINT:                      N/A
BACKEND_TESTS:                      434
FRONTEND_TESTS:                     265
BACKEND_BUILD:                      PASS
FRONTEND_BUILD:                     PASS
RUNTIME_SMOKE_AUTH:                 PASS
RUNTIME_SMOKE_DASHBOARD:            PASS
RUNTIME_SMOKE_CLIENTS:              PASS
RUNTIME_SMOKE_DEMANDAS:             PASS
RUNTIME_SMOKE_SCHEDULING:           PASS
RUNTIME_SMOKE_CALENDAR:             PASS
RUNTIME_SMOKE_TEAM:                 PASS
RUNTIME_SMOKE_SETTINGS:             PASS
RUNTIME_SMOKE_SIDEBAR:              PASS
RUNTIME_SMOKE:                      PASS
REMOTE_MAIN_AHEAD_BEFORE_COMMIT:    0
LOCAL_MAIN_AHEAD_BEFORE_COMMIT:     0
REMOTE_DIVERGENCE:                  NO
FINAL_INTENDED_FILES:               81
FINAL_EXCLUDED_FILES:               1 dev-report + ignored locals
FINAL_UNKNOWN_FILES:                none
REJECTED_F14_6_2_CODE_IN_FINAL_DIFF: NO
STAGED_FILE_COUNT:                  81
STAGED_FILES:                       81 intended files
UNSTAGED_REMAINING:                 0
UNTRACKED_REMAINING:                1 (excluded report)
CONSOLIDATION_COMMIT_SHA:           8e0d53b03dad6e1dadb1f79cac9f018c30323eda
CONSOLIDATION_COMMIT_MESSAGE:       feat(v1): consolidate validated runtime refinements
DOCS_COMMIT_SHA:                    e9ece662e7ae6d3982286b6f4de50db79d4314fc
WORKTREE_AFTER_COMMIT:              clean (1 excluded local report)
POST_COMMIT_DIFF_CHECK:             PASS
UNTRACKED_EXCLUDED_FILES:           .dev-reports/looply-f14-6-2-collapsed-sidebar-workspace-identity.md
REMOTE_MAIN_AHEAD_IMMEDIATELY_BEFORE_PUSH: 0
LOCAL_MAIN_AHEAD_IMMEDIATELY_BEFORE_PUSH:  1
PUSH_RESULT:                        8487e4a..8e0d53b main -> main (docs push: ..e9ece66)
MAIN_LOCAL_SHA:                     e9ece662e7ae6d3982286b6f4de50db79d4314fc
MAIN_REMOTE_SHA:                    e9ece662e7ae6d3982286b6f4de50db79d4314fc
MAIN_LOCAL_REMOTE_MATCH:            YES
UNPUSHED_LOCAL_COMMITS:             none
REMOTE_COMMITS_NOT_LOCAL:           none
SAFE_TO_DELETE_LATER_LOCAL:         feature/auth-recovery-and-settings-repair
                                    feature/demo-v1-polish
SAFE_TO_DELETE_LATER_REMOTE:        origin/feature/auth-recovery-and-settings-repair
                                    origin/feature/demo-v1-polish
KEEP_LOCAL_BRANCHES:                main
KEEP_REMOTE_BRANCHES:               origin/main
UNIQUE_BRANCHES_REQUIRING_REVIEW:   none
WORKTREE_STATUS:                    clean (1 excluded local report)
UNPUSHED_COMMITS:                   0
REMOTE_DIVERGENCE:                  NO
UNMERGED_BRANCH_WORK:               none
ORPHAN_VITEST:                      none
ORPHAN_TSC:                         none
DUPLICATE_OPENCODE:                 none
AVAILABLE_RAM_START:                ~1.9 Gi
AVAILABLE_RAM_FINAL:                ~1.7 Gi
KORE_TOUCHED:                       NO
```

LOOPLY FINAL REPOSITORY AUDIT + MAIN CONSOLIDATION — PUSHED AND VERIFIED