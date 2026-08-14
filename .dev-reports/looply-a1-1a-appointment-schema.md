# A1.1.a — Appointment Schema + Migration

## Baseline
- Branch: feature/demo-v1-polish
- Initial HEAD: 9230fe38ed38bd791bab4f135416f89f3bbb6ef5

## Schema Change
- Added `AppointmentStatus` enum with `SCHEDULED` and `CANCELLED`.
- Added `Appointment` model with `id`, `companyId`, `clientId`, `title`, `description`, `startsAt`, `endsAt`, `status`, `createdByUserId`, `createdAt`, `updatedAt`.

## Relations
- `company` relation added (required tenant authority, `onDelete: Restrict`).
- `client` relation added (optional, `onDelete: SetNull`).
- `createdBy` User relation added (optional, `onDelete: SetNull`).
- Inverse relations added to `Company`, `Client`, and `User`.

## Index
- Added `@@index([companyId, startsAt])`.

## Migration
- Added manual migration SQL `20260819100000_add_appointment_persistence/migration.sql` to avoid interactive prompts. Migration is purely additive and does not convert Job data.

## Prisma Validation
- `npm run prisma:validate` passed.
- `npm run prisma:generate` passed.

## Backend Validation
- `npm run typecheck` passed.
- `npm run build` passed.

## Changed Files
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260819100000_add_appointment_persistence/migration.sql`

## Preserved Dirty Files
- All frontend dirty files were preserved. No resets or stashes occurred.

## Commit
Commit will be made after tests pass.

## Next Step
Implement canonical `AppointmentService` and `Appointment` Express routes (A1.1.b / A1.1.c).
