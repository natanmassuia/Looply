# Performance Audit — Looply B9 Approval — 2026-08-14

## Executive Summary

1. Public Approval reads use one scoped projection and do not load full Job history, activities or all versions.
2. Public file download signs exactly one authorized attachment and does not HEAD/list storage objects.
3. Decision writes use one transaction and no per-file/per-decision N+1 loop.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/approvalService.ts:loadPublicApproval` | Public response loads all decisions/files associated with one Approval; expected small for V1. | Low | Add bounded history/file pagination if approval history grows materially. |
| `src/services/approvalService.ts:listApprovals` | Internal approval list has no explicit pagination. | Low | Add bounded pagination when a Job can accumulate many Approval rounds. |
| `src/services/approvalService.ts:publicFileDownload` | One presign operation per explicit download request. | Info | Correct behavior; do not batch or pre-sign all files. |

## Query / I/O Strategy

- Internal create: scoped Job/version/attachment validation, one transaction.
- Public read: one Approval projection with minimal Job/version/file metadata.
- Decision: one Approval lookup, one conditional transaction, one Activity write.
- Public file: Approval chain + one storage presign.
- No HEAD calls during public Approval read or file listing.

## Quick Wins

- Keep public payload projections minimal.
- Keep signed URLs generated only on request.
- Add pagination only after measuring real Approval/file history volume.

## Deferred

- Email/link delivery optimization.
- Public decision rate limiting.
- Historical decision archival.
