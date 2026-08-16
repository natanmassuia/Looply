# B6 — Job Activity Feed Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire real Job Activity Feed (`GET /api/jobs/:id/activity`) into `ContentDetail.tsx`.
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 13 test files, 190 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Finding Addressed
- **Wired Activity Feed**: `GET /api/jobs/:id/activity` exists on the backend but was previously unwired on the frontend.
- **Integrated Timeline**: Rendered real activity events chronologically with clear, customer-facing Portuguese copy in `ContentDetail.tsx`.

---

## Activity Backend Contract
- **Route**: `GET /api/jobs/:id/activity`
- **Permission**: Requires `JOBS` and `ACTIVITY` capability within the tenant company.
- **Response Shape**:
  ```json
  {
    "activities": [
      {
        "id": "activity-uuid",
        "jobId": "job-uuid",
        "actorUserId": "user-uuid | null",
        "type": "JOB_CREATED",
        "metadata": { "stageId": "stage-uuid" },
        "createdAt": "2026-08-16T18:00:00.000Z"
      }
    ]
  }
  ```

---

## Event Type Inventory
All backend Prisma `ActivityType` enum values:
- `JOB_CREATED`
- `JOB_UPDATED`
- `JOB_STAGE_CHANGED`
- `JOB_COMPLETED`
- `JOB_CANCELLED`
- `APPROVAL_REQUESTED`
- `APPROVAL_APPROVED`
- `APPROVAL_CHANGES_REQUESTED`
- `APPROVAL_REJECTED`
- `APPROVAL_REVOKED`

---

## Event Copy Mapping
Technical events translated into clear customer-facing product copy:
- `JOB_CREATED`: "criou este job"
- `JOB_UPDATED`: "atualizou os detalhes do job"
- `JOB_STAGE_CHANGED`: "alterou a etapa do job"
- `JOB_COMPLETED`: "marcou o job como concluído"
- `JOB_CANCELLED`: "cancelou este job"
- `APPROVAL_REQUESTED`: "enviou o job para aprovação do cliente"
- `APPROVAL_APPROVED`: "aprovou o conteúdo"
- `APPROVAL_CHANGES_REQUESTED`: "solicitou alterações no conteúdo"
- `APPROVAL_REJECTED`: "reprovou o conteúdo"
- `APPROVAL_REVOKED`: "revogou o link de aprovação"

No raw technical enums (`JOB_CREATED`) or internal metadata (`stageId`, `approvalId`) are leaked to the UI.

---

## Actor Semantics
- If `actorUserId` matches assigned responsible or team member: displays the actor's real name.
- For public client approval actions (`APPROVAL_APPROVED`, `APPROVAL_CHANGES_REQUESTED`, `APPROVAL_REJECTED`): actor is identified truthfully as "Cliente".
- For automated/system actions without user id: actor is displayed as "Sistema".

---

## Frontend Query
- Hook: `useJobActivity(jobId)` in `frontend/src/lib/api.ts`.
- Query key: `["jobActivity", jobId]`.
- Enabled only when a valid `jobId` is provided.

---

## Query Invalidation
`["jobActivity", jobId]` is automatically invalidated and refetched after all related mutations:
- `useUpdateJob`
- `useWorkflowAction` (`review`, `send-approval`, `schedule`, `publish`)
- `useCreateVersion`
- `useUngroupContent`
- `useUploadJobAttachment`
- `useDeleteJobFile`

---

## Job Detail Integration
- Embedded in the right column of `ContentDetail.tsx` under the `Ações` Card.
- Preserves the approved F7 visual hierarchy and column balance without interfering with version history, previews, or file attachments.

---

## Timeline Presentation
- Each row shows:
  - Contextual icon (`IconCheck`, `IconX`, `IconSend`, `IconEdit`, `IconClock`).
  - Actor name + human-readable event description.
  - Relative time ("há 15 min") and formatted localized timestamp.

---

## Loading
- Dedicated localized loading state inside the card ("Carregando atividades…") without blanking the rest of the job detail view.

---

## Empty
- Displays a clean empty state: "Nenhuma atividade registrada neste job ainda." when activities array is empty.

---

## Error
- Localized error state ("Falha ao carregar histórico de atividades.") with an inline "Tentar novamente" button that triggers `refetch()`.

---

## Pagination
- Backend endpoint returns full activity list ordered by `createdAt: asc`. No artificial pagination controls were added.

---

## Permissions
- Reuses tenant company capability authorization.

---

## Semantic Theme
- Standard Looply CSS variables used:
  - Background surface and borders: `var(--looply-color-border-default)`, `var(--looply-color-bg-subtle)`
  - Text colors: `var(--looply-color-text-primary)`, `var(--looply-color-text-muted)`
  - Status indicators: `var(--looply-color-status-success)`, `var(--looply-color-status-danger)`, `var(--looply-color-action-primary)`

---

## Runtime Validation
1. **Activity List Fetch**: Verified `GET /api/jobs/:id/activity` is triggered on viewing a job.
2. **Timeline Rendering**: Verified activities display formatted description, actor name, and date.
3. **Enum Protection**: Confirmed raw enums are translated into Portuguese.
4. **Empty State**: Verified empty job displays clear empty message.
5. **Error & Retry**: Verified failed fetch displays localized error box with functioning retry button.

---

## Files Modified

- `frontend/src/lib/types.ts`: Added `ActivityType` and `JobActivity`.
- `frontend/src/lib/api.ts`: Added `useJobActivity` hook and query invalidation updates across mutation hooks.
- `frontend/src/features/ContentDetail.tsx`: Integrated `JobActivityTimeline` and copy mapping.
- `frontend/src/tests/activity.test.tsx`: Added 3 automated tests covering all B6 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `13 passed (190 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 6.62s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.**

---

## Visual Freeze Preservation
The visual language from F7 is completely preserved. The added activity feed uses standard Looply design tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files in backend and frontend were preserved without resets, stashes, or checkouts.

---

## Remaining Activity Gaps
None. Real activity events, actor resolution, Portuguese copy mapping, error handling, and mutation invalidation are completely wired.

---

## Ponytail Lite Review
- Minimal, clean timeline component using existing card primitives.
- No heavy timeline libraries or animation frameworks added.
- Simple, localized error and loading states.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
ACTIVITY_INTERACTIONS_TOTAL: 2
CONNECTED_AND_WORKING: 2
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B6 JOB ACTIVITY WIRING — READY FOR REVIEW
