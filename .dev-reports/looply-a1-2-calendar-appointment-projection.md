# A1.2 Calendar Projection — Jobs + Appointments + Global 500 Cap

## Overview
This report details the implementation of the calendar projection feature (A1.2), which integrates `Appointment` objects alongside `Job` events while adhering to a strict 500-item global cap.

## Changes Implemented
1. **Appointment Querying**: Integrated the `Appointment` entity into the calendar query inside `backend/src/services/calendarService.ts`. Appointments are fetched by `companyId` and filtered to include only `SCHEDULED` status, effectively excluding `CANCELLED` ones.
2. **Interval Check Constraints**: Added proper query logic to fetch appointments that overlap with the requested timeframe:
   `startsAt < to && (endsAt == null || endsAt > from)`
3. **Global Query Limit**: Both Job and Appointment queries were limited to `MAX_EVENTS + 1` (501 items) to prevent runaway database scanning.
4. **Global Sorting & Slicing**: After merging all events (Job publication dates, scheduled dates, and Appointments), the list is sorted chronologically by `at` time, and fallback to `id` for stability.
5. **Truncation Flag**: The response is sliced to 500 items. If the total events exceeded 500, a `truncated = true` flag is properly returned.
6. **DTO Mapping**: Appended appointments map accurately to the canonical event format:
   ```json
   {
     "id": "<id>:appointment",
     "appointmentId": "<id>",
     "type": "APPOINTMENT",
     "at": "startsAt",
     "title": "Title",
     "client": { "id": "...", "name": "..." }
   }
   ```
7. **Testing**: 
   - Augmented pure range contract tests with Appointment mocks.
   - Added integration test `Calendar appointment integration` inside `backend/tests/calendar.test.ts` to verify overlapping interval logic and cancellation exclusion.
   - Re-verified standard tests.

## Summary
The projection API is now robust, safely capping events and accurately surfacing both Jobs and Appointments onto the V1 Calendar.
