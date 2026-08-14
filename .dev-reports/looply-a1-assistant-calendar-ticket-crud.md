# Looply Assistant Core — A1 Final

## Executive Decision

**A1 COMPLETE — PASS**. The previous high-severity lifecycle bypass is remediated. Job lifecycle changes now use one canonical transition primitive; generic Job updates cannot mutate `lifecycleStatus`.

## Changes

| Area | Status |
|---|---|
| Canonical Job lifecycle | PASS |
| Generic update protection | PASS |
| Ticket cancellation | PASS |
| Appointment/Calendar regression | PASS |
| Assistant implementation | Deferred to A2 |

## Baseline and Git

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| Initial SHA | `4a0e842048cd45d8ca383675ba4060e736ab6d3d` |
| Initial ancestry | `6df3462`, `3154b0f`, `4897a31`, `4a0e842` |
| Frontend dirty staged | NO |
| Database mutation | NONE |
| Secret exposure | NONE |

## Job Lifecycle

States are exactly `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

Canonical function: `transitionJobLifecycle(db, companyId, actorUserId, jobId, targetStatus)` in `backend/src/services/jobService.ts`.

| From | Allowed target |
|---|---|
| `OPEN` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | none; terminal |
| `CANCELLED` | `CANCELLED` only; idempotent |

The function looks up by `id + companyId`, validates before persistence, updates transactionally, records lifecycle Activity, and never deletes a Job.

## Generic Update Protection

`updateJob` no longer accepts or writes `lifecycleStatus`. `PATCH /api/jobs/:id` schema no longer exposes that field. Lifecycle changes cannot bypass the transition matrix.

## Ticket Delete Mapping

`ticket.delete` -> `transitionJobLifecycle(..., "CANCELLED")` -> logical cancellation. It does not call generic `updateJob`, does not issue a direct Prisma lifecycle update outside the canonical primitive, and does not hard-delete.

## Capability and Tenant Rules

Basic Job routes require `Capability.JOBS`. Lifecycle is a Job-level primitive and does not require `WORKFLOW`; existing Stage transition remains separately guarded by `WORKFLOW`. `companyId` is supplied by authenticated context, foreign Job transitions return 404, and the update predicate retains tenant ownership.

## Test Evidence

| Requirement | Evidence | Result |
|---|---|---|
| Generic update cannot mutate lifecycle | `backend/tests/jobLifecycle.test.ts` | PASS |
| OPEN -> IN_PROGRESS | `jobLifecycle.test.ts` | PASS |
| IN_PROGRESS -> COMPLETED | `jobLifecycle.test.ts` | PASS |
| OPEN/IN_PROGRESS -> CANCELLED | `jobLifecycle.test.ts` | PASS |
| Invalid terminal/reopen transitions rejected | `jobLifecycle.test.ts` | PASS |
| Foreign transition returns 404 | `jobLifecycle.test.ts` | PASS |
| Cancellation preserves row | `jobLifecycle.test.ts` | PASS |
| Repeated CANCELLED is idempotent | `jobLifecycle.test.ts` | PASS |
| Existing Stage/workflow transition | `jobsWorkflow.test.ts`, `jobsAtomic.test.ts` | PASS |
| Appointment regression | `appointmentService.test.ts`, `appointmentsRoute.test.ts` | PASS |
| Calendar regression | `calendar.test.ts` | PASS |

## Security Audit

| Finding | Result |
|---|---|
| Previous arbitrary lifecycle HIGH | RESOLVED |
| New Critical findings | 0 |
| New High findings | 0 |
| Cross-tenant lifecycle transition | BLOCKED with 404 |
| Lifecycle mass assignment | BLOCKED |
| Hard delete | ABSENT |
| Capability bypass | NONE |

## Performance Audit

| Area | Result |
|---|---|
| Lifecycle lookup/update | One scoped lookup plus one transactional update |
| Activity write | Transactional; no N+1 |
| Appointment/Calendar paths | Unchanged; prior bounded-query audit remains valid |
| Cache/Redis | None added |

## Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 181 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |

## Files

| File | Risk |
|---|---|
| `backend/src/services/jobService.ts` | Medium; canonical lifecycle authority |
| `backend/src/routes/jobs.ts` | Low; removes lifecycle mass-assignment input |
| `backend/tests/jobLifecycle.test.ts` | Low; focused contract coverage, 12 tests |
| `docs/engineering/14-assistant-calendar-ticket-crud.md` | Low; canonical contract update |
| `.dev-reports/looply-a1-assistant-calendar-ticket-crud.md` | Low; final audit |

## Eight Logical Operations

| Operation | Canonical mapping |
|---|---|
| `calendar.create` | `createAppointment` |
| `calendar.read` | Appointment list/detail + Calendar projection |
| `calendar.update` | `updateAppointment` |
| `calendar.delete` | `cancelAppointment` |
| `ticket.create` | `createJob` |
| `ticket.read` | `listJobs` / `getJob` |
| `ticket.update` | `updateJob` |
| `ticket.delete` | `transitionJobLifecycle` -> `CANCELLED` |

No Ticket model, no hard delete, and no Assistant router were added.

## Deferred A2

Assistant command router, `/api/assistant/commands`, operation registry, confirmations, and intent parsing.

## Deferred A3

WhatsApp text/audio intake, transcription, and outbound response.

## Commit

Pending final validation and explicit staging. No push or deploy.
