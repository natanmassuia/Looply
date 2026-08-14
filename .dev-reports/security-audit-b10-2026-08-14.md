# Security Audit — Looply B10 Calendar — 2026-08-14

## Scope

Reviewed Calendar range/query service, Job date mutation, tenant/capability chain, Client/Stage filters, result/range limits, legacy publication compatibility, and cross-tenant tests.

## Executive Summary

- Critical: 0
- High: 0
- Medium: 0
- Low: 1
- Informational: 3

## Low Finding

| Finding | Location | Decision |
|---|---|---|
| Calendar caps at 500 events but does not provide pagination/windowing | `backend/src/services/calendarService.ts` | Acceptable for bounded V1 ranges; return includes `totalEvents` and `truncated`. Revisit if operational volume grows. |

## Checked and Clean

- Calendar query always uses `req.auth.companyId`.
- `from`/`to` are required, parseable, ordered and capped at 90 days.
- Range semantics are `[from, to)`.
- `clientId` and `stageId` are validated inside the tenant.
- `companyId` query spoof is ignored.
- No raw sort/filter input reaches Prisma.
- Events contain minimal Job/Client/Stage metadata only.
- `publishedAt` is not projected as a future calendar event.
- Calendar is read-only; Job PATCH remains date write authority.
- CALENDAR capability is enforced.
- No CalendarEvent persistence, recurrence, external calendar integration or frontend changes.
- Legacy `publicationTarget`/`scheduledAt` values are reused without destructive migration.

## Informational Notes

- All current B3 templates include CALENDAR, so there is no existing production template that should receive a negative capability test; the route still uses the capability gate.
- Approval dates are intentionally excluded; Approval is not a Calendar event source.
- Dashboard aggregates remain B11.

## Out of Scope

- Calendar UI.
- Google/Outlook/ICS.
- Recurrence.
- Dashboard metrics.
- CSRF/rate-limit hardening (B12).
