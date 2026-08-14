# Looply V1 — Assistant CRUD Foundation

## Scope

A1 proves the domain contracts that a future Assistant command router may call. It does not implement an Assistant router, intent parser, LLM integration, WhatsApp intake, or frontend Assistant UI.

## Two Resources Only

The Assistant V1 vocabulary contains exactly two resources: `Calendar` and `Tickets`. `Ticket` is product vocabulary; the canonical backend resource is `Job`.

## Eight Logical Operations

| Operation | Canonical primitive |
|---|---|
| `calendar.create` | `createAppointment` |
| `calendar.read` | `listAppointments`/`getAppointment` plus Calendar projection |
| `calendar.update` | `updateAppointment` |
| `calendar.delete` | `cancelAppointment` |
| `ticket.create` | `createJob` |
| `ticket.read` | `listJobs`/`getJob` |
| `ticket.update` | `updateJob` |
| `ticket.delete` | `transitionJobLifecycle` to `CANCELLED` |

No Assistant registry code is part of A1. No ninth operation is defined. `client.*`, `file.*`, `approval.*`, `workflow.*`, `dashboard.*`, and `team.*` are out of scope.

## Assistant Vocabulary vs Canonical Domains

There is no Ticket model, table, status enum, repository, service, or persistence path. Prisma exposes `Job`, mapped to the existing physical `Content` table for compatibility. `/api/jobs` and `jobService` are the canonical Job primitives.

## Calendar Architecture

Calendar is a read projection. It has no persisted CalendarEvent model. Job dates and scheduled Appointments are queried by tenant, projected, merged, sorted, and capped in memory.

## Appointment Model

`Appointment` has `companyId`, optional tenant-owned `clientId`, title/description, `startsAt`, optional `endsAt`, `status`, actor, and timestamps. The enum is `SCHEDULED | CANCELLED`. The schema has `@@index([companyId, startsAt])`.

## Appointment API

Canonical routes are `POST /api/appointments`, `GET /api/appointments`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id`, and `POST /api/appointments/:id/cancel`. The router requires `Capability.CALENDAR`. Tenant and actor values come from authenticated server context; status is not mass-assignable. Cancel is an update and is idempotent. Cancelled appointments cannot be updated and are not hard-deleted.

## Calendar CRUD Mapping

Calendar create/update/delete operate on Appointment through the service above. Calendar read combines Appointment reads with the Job date projection. `GET /api/calendar` is read-only; Appointment CRUD remains at `/api/appointments`.

## Calendar Projection

The projection returns `PUBLICATION_TARGET` and `SCHEDULED` Job events and `APPOINTMENT` events. `CANCELLED` Appointments are excluded. Job events keep the Job lifecycle and current Stage projection; Appointment events expose the appointment and minimal Client projection.

## Calendar Range Semantics

The range is `[from,to)`: start inclusive, end exclusive, with `from < to` and a maximum span of 90 days. Job points use `from <= date < to`. Appointment intervals use `startsAt < to && (endsAt IS NULL || endsAt > from)`, so an interval that only touches either boundary does not overlap.

## Calendar Global Cap

Job and Appointment source queries are tenant-scoped and each take at most 501 records. The merged events are deterministically sorted by timestamp and derived ID, then limited to 500. `totalEvents` is the pre-cap merged count and `truncated` is true only when it exceeds 500.

## Tickets = Jobs

`ticket.create` calls `createJob`; `ticket.read` calls `listJobs` or `getJob`; `ticket.update` calls `updateJob`; and `ticket.delete` calls `transitionJobLifecycle` with `CANCELLED`. No adapter is needed for the existing service contract.

## Actual Job Lifecycle

The Prisma enum is exactly `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Job Stage transitions are handled separately by `transitionJob` and `POST /api/jobs/:id/transition`, which requires `WORKFLOW` and validates tenant/workflow/stage ownership. Lifecycle transitions are handled by `transitionJobLifecycle` in `jobService`; they are not Stage transitions.

The lifecycle matrix is:

| From | Allowed target |
|---|---|
| `OPEN` | `IN_PROGRESS`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` |
| `COMPLETED` | none; terminal |
| `CANCELLED` | `CANCELLED` only, idempotent |

## Ticket Create Mapping

`createJob(db, companyId, actorUserId, input)` validates the Client with `id + companyId`, derives `companyId` and actor from auth at the route, bootstraps the tenant workflow, and creates Job plus `JOB_CREATED` Activity transactionally. The route requires `JOBS`.

## Ticket Read Mapping

`listJobs` is paginated and bounded to a maximum limit of 100. `getJob` uses `where: { id, companyId }`. Foreign Jobs return 404. Both are exposed under `/api/jobs` and require `JOBS`.

## Ticket Update Mapping

`updateJob` scopes the existing Job and replacement Client to `companyId`, validates dates, and records `JOB_UPDATED` transactionally. It is the existing primitive for Job date writes used by Calendar. Its input does not contain `lifecycleStatus`.

## Ticket Delete/Cancel Mapping

Logical deletion maps to `transitionJobLifecycle(..., "CANCELLED")`; there is no `db.job.delete` or Job DELETE route. The transition validates the source state, records `JOB_CANCELLED` Activity transactionally, and preserves the row. Repeated cancellation is idempotent.

## Capability Matrix

| Contract | Capability |
|---|---|
| Calendar CRUD and projection | `CALENDAR` |
| Ticket basic create/read/update | `JOBS` |
| Ticket lifecycle cancellation | `JOBS`; lifecycle is a Job-level primitive and does not require `WORKFLOW` |

The Stage transition remains the only Job route with an additional `WORKFLOW` guard. No new capability was invented for lifecycle transitions.

## Tenant Isolation

| Resource | Authority | Foreign resource |
|---|---|---|
| Appointment | authenticated `companyId` | 404 |
| Calendar | authenticated `companyId` | 404 for foreign Client/Stage; foreign rows excluded |
| Job | authenticated `companyId` | 404 |
| Client relation | `id + companyId` validation | 404 |

Caller-supplied `companyId` is never authoritative.

## Delete Semantics

Appointment cancellation updates `status` to `CANCELLED`. Job cancellation calls the canonical lifecycle transition to `CANCELLED`. Neither logical operation physically deletes its row.

## Security

The remediation audit found no critical or high IDOR, tenant-spoofing, capability bypass, secret exposure, Appointment hard-delete, Job hard-delete, cancelled-Appointment calendar leakage, or lifecycle bypass. Generic Job update no longer accepts `lifecycleStatus`; lifecycle changes use the validated canonical transition.

## Performance

Appointment uses the `companyId + startsAt` index and bounded list queries. Calendar performs two bounded source queries, one merge, one deterministic sort, and no N+1 query. Job mappings reuse existing bounded Job queries. No cache, Redis, or new runtime query path was added.

## Known Gaps

No HTTP lifecycle route was added because A2 can call the canonical service primitive directly. A future HTTP lifecycle surface, if required, must delegate to `transitionJobLifecycle`.

## A2 Boundary

A2 may add `/api/assistant/commands`, a structured command schema, the exact eight-operation registry, confirmation policy, and intent parsing. It must call the canonical primitives documented here and must not add a Ticket persistence domain.

## A3 Boundary

A3 owns WhatsApp text/audio intake, transcription, and outbound responses. None is implemented or implied by A1.
