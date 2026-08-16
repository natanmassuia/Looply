# Security Audit — Looply B8 Files + Storage — 2026-08-14

## Scope

Reviewed JobAttachment schema/migration, S3-compatible storage adapter, upload intent/finalize/download/delete routes, tenant checks, storage key generation, metadata validation, package runtime dependencies, and fake-storage tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 1
- Informational: 4

## Low Finding

| Finding | Location | Decision |
|---|---|---|
| Storage routes return 503 until explicit bucket/credentials are configured | `backend/src/lib/storage.ts` | Safe fail-closed behavior. No local-disk fallback and no public bucket fallback. Deployment must configure private storage before enabling file operations. |

## Checked and Clean

- Attachment, Job and Company lookups are scoped by `companyId` from auth context.
- `jobId`, `companyId`, `uploadedByUserId`, and `storageKey` are never trusted from frontend input.
- Storage key is server-generated as `company/{companyId}/jobs/{jobId}/{uuid}`.
- Original filename is metadata only and never becomes a path.
- Control characters and CR/LF are removed from names; download Content-Disposition is encoded.
- Upload size is limited to 50 MB before signing.
- Presigned PUT/GET URLs are object-specific and expire after a bounded 60–900 seconds.
- Bucket credentials and storage keys are not returned in metadata/list responses.
- Finalize checks object existence, exact size and declared content type before `AVAILABLE`.
- PENDING files cannot be downloaded.
- Cross-tenant list, intent, complete, download and delete resolve to 404.
- Delete receives fileId only, resolves storageKey server-side, deletes object first, then metadata.
- Bucket is not made public and no local permanent storage is created.
- No base64 or request body bytes are persisted in PostgreSQL.
- No Approval/public file access was added.
- Runtime dependency audit (`npm --prefix backend audit --omit=dev`) reported zero vulnerabilities.

## Informational Notes

- S3-compatible credentials are intentionally required for real routes; tests use a fake storage adapter.
- Delete failure semantics are conservative: object delete failure leaves metadata for retry; DB failure after object deletion can leave an orphan object for future cleanup.
- Upload intents that never finalize remain PENDING; cleanup belongs to a later hardening/operations battery.
- Legacy `mediaUrl`/`mediaType` fields remain untouched; they are not silently converted to attachments.

## Out of Scope

- Public approval file access (B9).
- Files attached to Clients/Companies without a Job.
- Multipart proxy upload through Node.
- File scanning/antivirus.
- Frontend/Figma upload UI.
