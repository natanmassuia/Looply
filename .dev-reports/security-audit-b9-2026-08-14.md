# Security Audit — Looply B9 Approval — 2026-08-14

## Scope

Reviewed Approval schema/migration, legacy public routes, internal Approval routes, token hashing/lifecycle, decision concurrency, decision history, Activity integration, controlled public file access, storage key exposure, request logging, and tenant/capability tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 2
- Informational: 4

## Low Findings

| Finding | Location | Decision |
|---|---|---|
| Existing approvals receive a 30-day compatibility expiry during token-hash migration | `20260818100000_secure_approvals/migration.sql` | Preserves existing links for a bounded window without keeping plaintext tokens. Documented migration behavior. |
| Public decision endpoint has no dedicated rate limiter | `backend/src/routes/approvals.ts` | Token entropy is the primary brute-force defense; endpoint rate limiting remains B12 hardening. |

## Checked and Clean

- Existing 38 Approval rows preserved with IDs, Job links, JobVersion links, status and timestamps.
- Existing plaintext token values were hashed with SHA-256 and removed from the database.
- Public lookup uses `hashToken(input)` → `tokenHash`; public Approval ID is never authentication.
- Public approval token is redacted from request logs as `[redacted]`.
- Approval/company/job/version relationships are validated server-side.
- Internal routes require `APPROVAL` capability and tenant context.
- High Ticket/Agency capability behavior remains compatible; public token authorization is independent of session capability.
- Decision writes use a conditional update requiring PENDING, non-revoked, non-expired and undecided state.
- Conflicting replay returns 409; same decision replay is idempotent.
- ApprovalDecision is created in the same transaction as current status and Job legacy status update.
- Public payload excludes companyId, tokenHash, storageKey, internal notes, memberships, activities and unrelated approvals.
- Public files require ApprovalAttachment relation, matching Job/Company and AVAILABLE status.
- No generic public file endpoint was added.
- Storage remains private and reuses B8 presigned GET logic.
- Reviewer name/email are audit metadata, not authentication.
- No actorUserId/companyId/status/storageKey is trusted from public input.
- No frontend changes, no Approval frontend, no public bucket, no new raw SQL from request input.

## Informational Notes

- Historical decisions are not fabricated for pre-B9 rows; current legacy status is preserved and new decisions create explicit history.
- Existing demo seed still creates fresh demo Approval links when run; this is seed behavior, not production token persistence behavior.
- Token URLs can appear in browser history or upstream access logs; application request logging is redacted. Deployment proxy log policy remains operational work.
- Public file access returns 503 when B8 storage credentials are absent, after approval authorization.

## Out of Scope

- Email delivery.
- Public approval UI.
- Approval-specific rate limiting.
- Files scanning.
- Calendar, Dashboard and frontend integration.
