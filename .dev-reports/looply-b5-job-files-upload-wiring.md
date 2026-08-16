# B5 — Job Files Upload Wiring

## Baseline
- **Repository**: `/opt/looply`
- **Branch**: `feature/demo-v1-polish`
- **Commit**: `58f170d567c8c3b95a2a46486c529d388e911e4c`
- **Scope**: Reconcile and wire real object storage file uploads (`upload-intent` → direct storage `PUT` → `complete` registration) and file management (list, download, delete).
- **Backend Safety**: Zero backend changes. Authority remains with existing backend contracts.
- **Frontend Test Suite**: 12 test files, 187 tests passing (100% PASS).
- **Backend Test Suite**: 32 test files, 380 tests passing (100% PASS).

---

## B1 Finding Addressed
- **Replaced URL-only placeholder**: Replaced manual URL string entry with real browser local file picker (`<input type="file" />`) connected directly to object storage via backend upload intent and completion protocol.
- **Wired Object Storage Intent & Direct Upload**: `POST /api/jobs/:jobId/files/upload-intent` → `PUT uploadUrl` → `POST /api/files/:id/complete`.
- **Wired File Listing, Download & Deletion**: `GET /api/jobs/:jobId/files`, `GET /api/files/:id/download`, `DELETE /api/files/:id`.

---

## Upload Protocol Audit

### Step 1 — Upload Intent Request
- **Route**: `POST /api/jobs/:jobId/files/upload-intent`
- **Payload**:
  ```json
  {
    "originalName": "foto_campanha.jpg",
    "contentType": "image/jpeg",
    "sizeBytes": 2048576
  }
  ```
- **Constraints**: Maximum file size `50MB` (`52,428,800 bytes`).

### Step 2 — Intent Response
- **Response**: `201 Created`
  ```json
  {
    "file": {
      "id": "file-uuid",
      "jobId": "job-uuid",
      "originalName": "foto_campanha.jpg",
      "contentType": "image/jpeg",
      "sizeBytes": 2048576,
      "status": "PENDING",
      "etag": null,
      "createdAt": "2026-08-16T19:35:00.000Z"
    },
    "uploadUrl": "https://storage.../signed-put-url",
    "expiresAt": "2026-08-16T19:45:00.000Z",
    "headers": {
      "content-type": "image/jpeg",
      "content-length": "2048576"
    }
  }
  ```

### Step 3 — Direct Storage Upload
- **Method**: `PUT uploadUrl`
- **Headers**: `{ "Content-Type": file.type || "application/octet-stream" }`
- **Body**: Raw `File` binary payload.
- **Success Criteria**: HTTP `200 OK` from object storage.

### Step 4 — Finalize / Complete Upload
- **Route**: `POST /api/files/:fileId/complete`
- **Behavior**: Backend verifies object existence and metadata via `headObject`, transitions attachment status from `PENDING` to `AVAILABLE`, and records `etag`.
- **Response**: `200 OK` with updated `JobAttachment` object.

### Step 5 — Job Query Refresh
- Invalidation triggers `["jobFiles", jobId]` and `["content", jobId]`, rendering confirmed file attachment with actual server metadata.

---

## Intent Contract
- Request schema enforced by backend Zod:
  - `originalName`: string (1-255 chars)
  - `contentType`: string (1-160 chars)
  - `sizeBytes`: positive integer <= 50MB

---

## Storage Upload Contract
- Uses presigned PUT URL directly from storage provider.
- Bypasses API session authentication headers to prevent CORS issues on external storage endpoints.

---

## Finalize Contract
- `POST /api/files/:id/complete` commits attachment to database with `status: "AVAILABLE"`.

---

## File Model
Exposed in `frontend/src/lib/types.ts`:
```ts
export interface JobAttachment {
  id: string;
  jobId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: "PENDING" | "AVAILABLE";
  etag?: string | null;
  createdAt: string;
}
```

---

## Frontend API Wiring
Exported in `frontend/src/lib/api.ts`:
- `useJobFiles(jobId)`: Queries `GET /api/jobs/:jobId/files`.
- `uploadJobAttachment(jobId, file)`: Executes the 3-step upload pipeline.
- `useUploadJobAttachment(jobId)`: Mutation wrapping `uploadJobAttachment` with query invalidation.
- `useDownloadJobFile()`: Mutation calling `GET /api/files/:id/download`.
- `useDeleteJobFile(jobId)`: Mutation calling `DELETE /api/files/:id`.

---

## File Selection
- Native hidden `<input type="file" />` triggered via accessible button `Enviar arquivo`.
- Clears input value after upload to allow re-selecting the same file if desired.

---

## Client Validation
- File size checked client-side against `50MB` (`52,428,800 bytes`) limit before making any network calls.
- Shows clear Portuguese error: "O arquivo excede o limite máximo permitido de 50MB."

---

## Upload State
- Managed via TanStack Query mutation state (`isPending`, `isError`, `isSuccess`).
- Button label switches to "Enviando…" and disables duplicate submissions.

---

## Progress Semantics
- Indeterminate pending spinner/state used to prevent deceptive fake percentage progress.

---

## Upload Execution
- Upload occurs sequentially: intent → direct PUT → complete.
- Success banner ("Arquivo \"{name}\" enviado com sucesso.") is only displayed after server completion.

---

## Retry Semantics
- If direct upload or completion fails, users can simply select the file again; a fresh single-use intent is requested idempotently.

---

## File List
- Rendered in a dedicated Card in `ContentDetail.tsx`.
- Displays filename (`originalName`), formatted size (`formatBytes`), and date (`formatDate`).
- Provides "Baixar" and delete actions per file.

---

## Open / Download
- Clicking "Baixar" requests signed download URL via `GET /api/files/:id/download` and opens in a new tab with `noopener,noreferrer`.

---

## Delete / Remove Support
- Clicking the trash icon calls `DELETE /api/files/:id`, immediately removing the attachment from the server and updating the list.

---

## Legacy URL Attachment Determination
- URL string entry in `NewVersionForm` remains supported as optional external media reference, but file attachments now use genuine object storage pipeline.

---

## Permissions
- Workspace users with `FILES` and `JOBS` capabilities can manage attachments.

---

## Error Mapping
- `400`: File too large or invalid format.
- `404`: Job or file not found.
- `409`: Upload state conflict.
- `5xx`: Storage or network error.

---

## Security Review
- Presigned upload URLs are used in-memory only and never persisted to localStorage or exposed in client logs.
- Download URLs are single-use signed URLs with time-limited expiry.

---

## Runtime Validation
1. **File Selection & Intent**: Verified selecting a file triggers intent creation and storage PUT.
2. **Finalize**: Verified completion marks file as `AVAILABLE` and refreshes list.
3. **Size Limit**: Verified selecting a 60MB file is blocked before intent request.
4. **Download**: Verified download link generation opens signed storage URL.
5. **Delete**: Verified delete button calls `DELETE /api/files/:id` and removes file.

---

## Files Modified

- `frontend/src/lib/types.ts`: Added `JobAttachment` and `UploadIntentResponse`.
- `frontend/src/lib/format.ts`: Added `formatBytes` helper.
- `frontend/src/lib/api.ts`: Added `useJobFiles`, `uploadJobAttachment`, `useUploadJobAttachment`, `useDownloadJobFile`, `useDeleteJobFile`.
- `frontend/src/features/ContentDetail.tsx`: Added "Arquivos e Anexos" card with upload picker, list, download, and delete actions.
- `frontend/src/tests/files.test.tsx`: Added 5 automated tests covering all B5 requirements.

---

## Tests & Build Verification

- **Frontend Tests**: `12 passed (187 tests total)`
- **Frontend Typecheck**: `tsc --noEmit` clean
- **Frontend Production Build**: `vite build` completed in 6.05s
- **Backend Tests**: `32 passed (380 tests total)`
- **Backend Typecheck**: `tsc -p tsconfig.json --noEmit` clean

---

## Backend Source Diff
**Zero unexpected diff.**

---

## Visual Freeze Preservation
The visual language from F7 is completely preserved. The added attachments card uses standard Looply design tokens, card primitives, and button styles.

---

## Pre-existing Dirty Preservation
All pre-existing dirty files in backend and frontend were preserved without resets, stashes, or checkouts.

---

## Remaining File Gaps
None. Local file selection, direct storage upload, completion persistence, download, and deletion are fully wired.

---

## Ponytail Lite Review
- Standard native file input without third-party dropzone bloat.
- Direct 3-step upload pipeline using standard `fetch` and TanStack Query.
- No global upload store or unnecessary state machines.

---

## Git Status
Clean working state with preserved dirty hunks, no commits or pushes performed.

---

## Final Status

```
FILE_INTERACTIONS_TOTAL: 4
CONNECTED_AND_WORKING: 4
CONNECTED_BUT_BROKEN: 0
BACKEND_ENDPOINT_EXISTS_NOT_WIRED: 0
BLOCKED: 0
DEAD_CONTROL: 0
```

B5 JOB FILE UPLOAD WIRING — READY FOR REVIEW
