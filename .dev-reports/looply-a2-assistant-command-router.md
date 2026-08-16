# A2 — Assistant Command Router

## Executive Decision

**A2 IMPLEMENTED — PASS**. A deterministic structured-command router now exposes exactly eight operations, delegates to canonical services, enforces trusted tenant/capability context, and blocks unconfirmed mutations.

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| Initial SHA | `840594f13dab1d6d703af04b005071384f4d6800` |
| A1 ancestry | Present |
| Backend baseline | 181 tests |
| Frontend baseline | 32 tests |

## Architecture

`POST /api/assistant/commands` validates a structured command, derives trusted context, calls `executeAssistantCommand`, checks the closed registry capability, and delegates through existing Appointment, Calendar, and Job services. Assistant service code imports service functions and `DB` only as a type; it does not query Prisma resources.

## Operation Registry

| Operation | Delegation | Capability | Confirmation |
|---|---|---|---|
| `calendar.create` | `createAppointment` | `CALENDAR` | no |
| `calendar.read` | `listAppointments` / `getAppointment` / `getCalendar` | `CALENDAR` | no |
| `calendar.update` | `updateAppointment` | `CALENDAR` | yes |
| `calendar.delete` | `cancelAppointment` | `CALENDAR` | yes |
| `ticket.create` | `createJob` | `JOBS` | no |
| `ticket.read` | `listJobs` / `getJob` | `JOBS` | no |
| `ticket.update` | `updateJob` | `JOBS` | yes |
| `ticket.delete` | `transitionJobLifecycle` to `CANCELLED` | `JOBS` | yes |

Registry count: exactly 8. No ninth operation or dynamic dispatch exists.

## Command Schema

Strict request shape: `operation`, `payload`, optional `confirmed`. Each operation has its own strict Zod schema. Unknown operations and undeclared fields return `validation_error`.

## Calendar Delegation

Create converts ISO dates and calls `createAppointment`; read supports list/detail/range and calls the canonical corresponding service; update and logical delete require confirmation before calling `updateAppointment` or `cancelAppointment`. No Calendar or Appointment rules were duplicated.

## Ticket Delegation

Create/read/update call `createJob`, `listJobs`/`getJob`, and `updateJob`. Ticket update does not expose lifecycle, stage, workflow, company, actor, or capability fields. Ticket delete calls `transitionJobLifecycle(..., "CANCELLED")` and never hard-deletes.

## Canonical Lifecycle Usage

A1's transition matrix remains authoritative. The router does not call generic lifecycle updates or Prisma. Invalid lifecycle transitions propagate as sanitized canonical errors.

## Capability Matrix

| Resource | Required capability |
|---|---|
| Calendar operations | `CALENDAR` |
| Ticket operations | `JOBS` |
| Ticket lifecycle cancellation | `JOBS`; not `WORKFLOW` |

Capability is checked from trusted execution context, never from payload or LLM input.

## Tenant Isolation

`companyId` and `userId` come from authenticated context. Strict operation schemas reject caller-supplied ownership/actor fields. Canonical services receive the trusted company ID and continue to return 404 for foreign resources.

## Confirmation Policy

Reads and creates execute immediately. Updates and deletes return `ASSISTANT_CONFIRMATION_REQUIRED` with HTTP 409 unless `confirmed: true`; no domain service is called in the unconfirmed path.

## HTTP Route

`POST /api/assistant/commands` is mounted under the existing authenticated `/api` middleware chain. It returns structured success/error JSON and uses 400/403/404/409/500 status mapping without exposing stacks or database details.

## Security Audit

| Check | Result |
|---|---|
| Critical findings | 0 |
| High findings | 0 |
| Exact operation allowlist | PASS |
| Tenant/actor spoofing | BLOCKED |
| Capability bypass | BLOCKED |
| Lifecycle bypass | BLOCKED by A1 primitive |
| Hard delete | ABSENT |
| Prisma resource access from Assistant service | NO |
| LLM/provider dependency | NO |

## Tests

| Area | Result |
|---|---|
| Assistant focused suite | PASS, 9 tests |
| Registry and unknown operation | PASS |
| Capability and tenant context | PASS |
| Calendar/Ticket delegation | PASS |
| Confirmation and lifecycle cancellation | PASS |
| HTTP success/validation/auth boundary | PASS |

## Backend Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 190 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS |

## Frontend Regression

| Command | Result |
|---|---|
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |
| Frontend edits | NONE |

## Database Safety

No schema, migration, reset, deploy, push, execute, or psql mutation command was run.

## Secret Handling

No `.env`, `DATABASE_URL`, passwords, tokens, or secrets were printed or added.

## Changed Files

| File | Risk |
|---|---|
| `backend/src/services/assistantCommandService.ts` | Medium; command boundary and delegation |
| `backend/src/routes/assistant.ts` | Medium; authenticated HTTP adapter |
| `backend/src/app.ts` | Low; route mounting |
| `backend/tests/assistantCommand.test.ts` | Low; focused contract coverage |
| `docs/engineering/15-assistant-command-router.md` | Low; canonical documentation |
| `.dev-reports/looply-a2-assistant-command-router.md` | Low; A2 report |
| `.dev-reports/security-audit-a2-2026-08-14.md` | Low; security audit |
| `.dev-reports/performance-audit-a2-2026-08-14.md` | Low; performance audit |
| `.dev-reports/caveman-2026-08-14.md` | Low; simplification review |

## Preserved Dirty Files

All pre-existing dirty frontend files, unrelated reports, backup/config files, and package files were preserved and not staged.

## Commit

Pending final validation and explicit staging. No push or deploy.

## Deferred A3

Natural-language intake, LLM/provider integration, WhatsApp, audio, transcription, webhooks, and outbound responses.


Use the eight-operation structured router as the deterministic boundary for future natural-language and WhatsApp adapters. Do not add arbitrary tools outside the registry.
