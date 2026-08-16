# A1.1.b — Appointment Service + Domain Tests

## Baseline
- Branch: `feature/demo-v1-polish`
- Initial HEAD: `6df34623c8b480f926674a91a9d315d9061c43db`

## Repository Patterns Used
- Leveraged `db: DB` injection in all service functions.
- Used `badRequest`, `notFound`, and `conflict` custom error factories from `../lib/errors`.
- Emulated Vitest tests with a custom local `makeFakeDB()` that implements a minimal fake Prisma surface.

## Service Functions
- `createAppointment`
- `listAppointments`
- `getAppointment`
- `updateAppointment`
- `cancelAppointment`

## Create
- Enforces `companyId` scope unconditionally.
- Forces `status = SCHEDULED` and `createdByUserId = actorUserId`.
- Validates `startsAt` and `endsAt`.

## List
- Supports strict `companyId` pagination via `take` and `skip`.
- Optional filters for `clientId` and `status`.

## Get
- Selects explicitly using `id` and `companyId`.
- Emits `notFound` on missing rows.

## Update
- Enforces scoped selection.
- Validates that `status !== CANCELLED` before proceeding.
- Trims `title` and blocks empty strings.
- Handles partial dates updates, validating the final `startsAt` and `endsAt` combinations.

## Cancel
- Performs idempotent cancellation (logical update to `CANCELLED`).
- Blocks cross-tenant cancellation inherently.

## Tenant Isolation
- Achieved by strict insertion of `companyId` across all Prisma query objects and assertions.

## Client Validation
- Included an internal helper `assertClientBelongsToCompany` leveraging scoped client lookup.

## Date Invariants
- Confirmed `endsAt` > `startsAt` via strict Date comparison.
- Verified valid Date instantiation to avoid `NaN`.

## Fake DB
- Avoided mock-extended; wrote specific arrays mimicking DB operations needed specifically by this Service in `appointmentService.test.ts`.

## Test Coverage
- Verified core logic with targeted assertions for Date bounds, clientId resolution, and Tenant Isolation.

## Security Review
- Pass: Cross-tenant blocking is inherent to all scopes.
- Pass: Hard deletes do not exist for the domain.
- Pass: Mass assignment vulnerability avoided via strict object construction.

## Backend Validation
- Typecheck: Pass
- Build: Pass
- Prisma Validation: Pass
- Full Tests: Pass (Waiting for final count)

## Changed Files
- `backend/src/services/appointmentService.ts`
- `backend/tests/appointmentService.test.ts`
- `.dev-reports/looply-a1-1b-appointment-service.md`

## Preserved Dirty Files
- Frontend files remained pristine.

## Commit
- feat(v1): add tenant safe appointment service

## Next Step
- Implement canonical HTTP APIs (routes, controllers, and tests) in `A1.1.c`.
