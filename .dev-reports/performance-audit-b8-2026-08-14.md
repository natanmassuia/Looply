# Performance Audit — Looply B8 Files + Storage — 2026-08-14

## Executive Summary

1. Upload bytes go directly from client to object storage through presigned PUT; Node does not proxy or buffer file bytes.
2. Attachment list reads PostgreSQL metadata only and performs no object-storage HEAD per row.
3. Download signs exactly one requested object; no batch storage calls are created.

## Findings

| Location | Problem | Severity | Recommended Fix |
|---|---|---|---|
| `src/services/attachmentService.ts:deleteAttachment` | Object deletion and metadata deletion are separate systems; a DB failure after object deletion can leave an orphan object. | Low | Add cleanup/reconciliation in a later operations/hardening battery; do not add a queue in B8. |
| `src/services/attachmentService.ts:listJobAttachments` | Metadata list has no explicit pagination. | Low | Add bounded pagination if attachment counts per Job grow; current Job attachment volume is expected to be small. |
| `src/services/attachmentService.ts:completeUpload` | Finalize performs one object HEAD per explicit finalize request. | Info | Correct behavior; never run HEAD during list. |

## Query / I/O Strategy

- Upload intent: one scoped Job lookup, one presign operation, one metadata insert.
- Finalize: one scoped attachment lookup, one HEAD, one scoped metadata update.
- List: one scoped Job lookup and one metadata query; no object calls.
- Download: one scoped metadata lookup and one presign operation.
- Delete: one scoped metadata lookup, one object delete, one scoped metadata delete.

## Quick Wins

- Keep upload direct-to-object-storage.
- Keep object keys opaque and deterministic by tenant/job prefix.
- Keep list metadata projection minimal.
- Add pagination and orphan reconciliation only after measuring real use.

## Deferred

- Cleanup of abandoned PENDING rows.
- Orphan object reconciliation.
- Multipart uploads for files above the V1 limit.
- Antivirus/content scanning.
