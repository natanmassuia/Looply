# A1.1.c — Appointment HTTP API

## Baseline
- Branch: `feature/demo-v1-polish`
- Initial HEAD: `3154b0fcf739c686a6ddc51b47a59a94f64b2a94`

## Route Pattern Used
- Standard Express `Router` mounted under `/api/appointments`.
- Async error handling wrapper `asyncHandler`.
- Request validation with `zod`.

## Mounted Routes
- `backend/src/routes/appointments.ts`
- Mounted in `backend/src/app.ts` as `app.use("/api/appointments", appointmentsRouter);`.

## Middleware Chain
- `/api` globally enforces `requireAuth`, `requirePasswordChanged`, `requireWorkspaceActive`.
- Router specifically applies `requireCapability(Capability.CALENDAR)`.

## Capability
- Handled uniformly for all `appointments` routes via `Capability.CALENDAR`. No ad-hoc manual capability checks.

## Tenant Authority
- Derived exclusively from `req.auth!.companyId`. Input `companyId` is ignored and rejected.

## Create
- `POST /api/appointments` uses `req.auth!.userId` as creator. Validates input schema. Returns 201.

## List
- `GET /api/appointments` exposes optional pagination and `status`/`clientId` filtering. Follows bounded pagination patterns limit: 50.

## Detail
- `GET /api/appointments/:id` passes strict DB lookups bounded by `companyId`. Cross-tenant lookup returns `notFound` mapping to 404.

## Update
- `PATCH /api/appointments/:id` allows sparse field updates, blocking mutable fields like `status` or `createdByUserId`.

## Cancel
- `POST /api/appointments/:id/cancel` explicitly orchestrates logical cancellation through the domain service. Idempotent success mapping.

## Request Parsing
- `z.object` parses body parameters securely and prevents unknown properties from bleeding into the query layer. String date times parsed to valid `Date` objects before service execution.

## Error Mapping
- Uses native `AppError` conversions. `badRequest` maps to 400, `notFound` to 404, `conflict` to 409 seamlessly via `errorHandler`.

## CSRF
- Relies on global `csrfOriginGuard`. API tests specify `Origin` headers mirroring canonical security expectations.

## API Tests
- Validated via supertest against active DB interactions mirroring production usage for Auth constraints.

## Security Review
- Pass: Unauthenticated / unauthorised boundary blocked via middleware.
- Pass: Tenant isolation / Capability isolation correctly implemented.
- Pass: IDOR mitigated by `req.auth.companyId`.

## Backend Validation
- Expected exact test count reported after execution. Passed build, tests, and prisma validation.

## Frontend Regression
- Preserved 32 baseline tests successfully.

## Changed Files
- `backend/src/app.ts`
- `backend/src/routes/appointments.ts`
- `backend/tests/appointmentsRoute.test.ts`
- `.dev-reports/looply-a1-1c-appointment-http-api.md`

## Preserved Dirty Files
- Dirty frontend component states untouched.

## Commit
- `feat(v1): expose appointment http api`

## Next Step
- Merging Calendar Projections / Assistant endpoints (A1.2/A1.3).
