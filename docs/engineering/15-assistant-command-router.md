# Looply V1 — Assistant Command Router

## Purpose

A2 adds deterministic execution for the two A1 resources: Calendar and Tickets. It accepts structured commands only. It does not parse natural language, call an LLM, or integrate WhatsApp.

## Architecture

`HTTP request -> authenticated context -> structured command validation -> operation registry -> capability check -> canonical domain service -> structured result`.

The implementation is in `backend/src/services/assistantCommandService.ts`. The HTTP adapter is `backend/src/routes/assistant.ts`.

## Trust Boundary

The command payload is untrusted. `companyId`, `userId`, and capabilities come from server-authenticated context. Payload schemas are strict and reject ownership, actor, status, lifecycle, and other undeclared fields.

The router has no Prisma resource queries. The HTTP adapter reads the authenticated company's template only to construct the capability context; resource persistence remains inside canonical services.

## Exact Eight Operations

| Operation | Capability | Confirmation |
|---|---|---|
| `calendar.create` | `CALENDAR` | no |
| `calendar.read` | `CALENDAR` | no |
| `calendar.update` | `CALENDAR` | yes |
| `calendar.delete` | `CALENDAR` | yes |
| `ticket.create` | `JOBS` | no |
| `ticket.read` | `JOBS` | no |
| `ticket.update` | `JOBS` | yes |
| `ticket.delete` | `JOBS` | yes |

The registry is a closed eight-key object. There is no wildcard or dynamic operation loading.

## Command Schema

The command shape is:

```json
{
  "operation": "calendar.read",
  "payload": { "mode": "list" },
  "confirmed": false
}
```

`confirmed` is an execution option for mutation operations. Payload validation is operation-specific and strict. Natural-language fields such as `message` are not accepted.

## Execution Context

The executor receives `{ companyId, userId, capabilities }`. It does not derive authority from payload values or operation names. The HTTP route obtains identity from `req.auth` and capabilities from the authenticated company's workspace template.

## Operation Registry

`ASSISTANT_OPERATIONS` is the literal union source. `ASSISTANT_OPERATION_REGISTRY` maps every operation to exactly one capability and confirmation flag. Dispatch is an explicit switch, not arbitrary property/function dispatch.

## Calendar Mappings

`calendar.create` delegates to `createAppointment` after converting ISO dates to `Date` values. `calendar.read` supports list/detail/range: list delegates to `listAppointments`, detail to `getAppointment`, and range to `getCalendar`. `calendar.update` delegates to `updateAppointment` after confirmation. `calendar.delete` delegates to `cancelAppointment` after confirmation.

Appointment tenant, Client, status, cancellation, and date rules remain in `appointmentService`. Calendar range and cancelled-event behavior remain in `calendarService`.

## Ticket Mappings

`ticket.create` delegates to `createJob`. `ticket.read` supports list/detail and delegates to `listJobs` or `getJob`. `ticket.update` delegates to `updateJob` after confirmation and does not expose `lifecycleStatus`, stage, or workflow mutation. `ticket.delete` delegates to `transitionJobLifecycle(..., "CANCELLED")` after confirmation.

No Ticket model or Ticket persistence path exists.

## Capability Enforcement

The executor checks the registry capability against trusted context before delegation. Calendar requires `Capability.CALENDAR`; Tickets require `Capability.JOBS`. `WORKFLOW` is not required for Ticket lifecycle cancellation because A1 defines lifecycle as a Job-level primitive. Stage transitions remain outside A2 and retain their existing `WORKFLOW` route guard.

## Tenant Authority

Every canonical service call receives `context.companyId`. Strict schemas reject `companyId`, `userId`, `role`, `capabilities`, and undeclared fields. Foreign resources continue to be hidden by canonical service 404 behavior.

## Confirmation Policy

Reads and creates execute without confirmation. Updates and logical deletes require `confirmed: true`. The executor returns `ASSISTANT_CONFIRMATION_REQUIRED` and does not call a domain service when confirmation is missing. This is deterministic execution authorization, not conversational confirmation UI.

## Error Contract

Success returns `{ ok: true, operation, result, confirmationRequired }`. Failure returns `{ ok: false, operation?, error: { code, message } }`. Canonical `AppError` codes are preserved without stack traces or database internals. Confirmation maps to HTTP 409; validation to 400; forbidden to 403; not-found to 404.

## HTTP Endpoint

Structured commands are accepted at authenticated `POST /api/assistant/commands`. The app-wide middleware chain still applies: authentication, password-change guard, active-workspace guard, CSRF, and request logging. The route does not accept natural-language commands.

## Security

The router has an exact allowlist, strict schemas, trusted tenant/actor/capability context, no hard delete, no lifecycle bypass, and no arbitrary dispatch. Sensitive mutations cannot execute without confirmation. No LLM or external provider is used.

## Tests

`backend/tests/assistantCommand.test.ts` covers the exact registry, unknown operations, strict payloads, capability separation, tenant/actor propagation, all Calendar/Ticket delegation modes, confirmation blocking, canonical lifecycle cancellation, sanitized errors, HTTP success/validation, and unauthenticated access. Existing Appointment, Calendar, and Job suites remain regression coverage.

## Deferred Natural Language

Intent parsing, prompts, model providers, structured model output, and tool/function calling are deferred. A2 consumes already structured commands only.

## Deferred WhatsApp

WhatsApp intake, text/audio handling, transcription, outbound responses, and webhook processing are deferred to A3.
