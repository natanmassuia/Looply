# Looply — Figma → Runtime Reconciliation & Password Recovery (Resend) Implementation Report

**Document ID**: `.dev-reports/looply-figma-runtime-reconciliation-auth-recovery.md`  
**Target Branch**: `main`  
**Figma Authority**: `Looply — Brand + Product` (`8JDixNLJNe1f3KVPRwEFBi`)  
**Status**: `READY FOR ACTIVATION`

---

## 1. Executive Summary & Scope

A fresh reconciliation between the canonical Figma designs (`Looply — Brand + Product`, key: `8JDixNLJNe1f3KVPRwEFBi`) and the Looply runtime was conducted to resolve design-to-code deltas, implement the transactional Password Recovery and Reset Password flows with Resend, and finalize company, credential, and shell interactions.

All implementations strictly respect:
- Existing backend architecture, tenancy guarantees, and database immutability rules.
- Single-tenant, Brazilian Portuguese copy.
- Zero user enumeration security posture on all public authentication interfaces.
- Additive Prisma schema evolution (`PasswordResetToken` model).
- Production-grade transactional email dispatching via Resend.

---

## 2. Figma → Runtime Reconciliation Matrix

| Surface / Flow | Figma Node Reference | Previous State | Reconciled Implementation & Contract |
| :--- | :--- | :--- | :--- |
| **Password Recovery** | 05.1 / 03 — Recovery (`51:15`) | Static placeholder notice on Login | `/forgot-password` route with email input, neutral success feedback, and transactional email via Resend |
| **Reset Password** | 05.1 / 03 — Reset Password (`51:15`) | Missing | `/reset-password` route with token validation, policy enforcement (10+ chars), confirmation matching, session revocation, and auto-redirect |
| **App Shell Logo** | 04 — App Shell (`388:22`) | Static brand container | Logo upper-left wrapped in accessible link navigating to Home (`/dashboard`) |
| **Desktop Account Menu** | 04 — App Shell (`388:22`) | Top-right header logout button | Lower-left sidebar user card trigger with popup menu: `Minha conta`, `Configurações`, `Sair do Looply` |
| **Dashboard Greeting** | 06 — Dashboard (`388:79`) | Static fallback / hardcoded team lookup | Dynamic time-based greeting (`Bom dia`, `Boa tarde`, `Boa noite, {Nome}`) using live session (`useMe`) |
| **Calendar Creation** | 09 — Calendar (`390:39`) | Only top-level button | Date cell click pre-fills `Novo compromisso` with clicked date; child appointment/publication click propagation stopped |
| **Team Security & Credentials** | 10 — Team / 03 — Actions (`391:2`) | Role toggle only | `Redefinir acesso` action generating temporary password, forcing change on next login, revoking active sessions, and rendering secure copy modal |
| **Company Settings** | 12 — Settings / 04 (`391:32`) | Read-only disabled inputs | Editable company name and predefined timezone dropdown (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `America/Noronha`, `America/Fortaleza`, `America/Cuiaba`, `UTC`) connected to backend |

---

## 3. Backend & Security Architecture

### 3.1. Database Schema Additions
Added `PasswordResetToken` model with cascade deletion on user removal:
```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```
Additive migration created in: `backend/prisma/migrations/20260823100000_password_reset_token/migration.sql`.

### 3.2. Transactional Mail Service (Resend)
- **Service**: [mailService.ts](file:///opt/looply/backend/src/services/mailService.ts)
- **Sender**: `Looply <acesso@auth.verbumlab.com.br>`
- **Reply-To**: `suporte@verbumlab.com.br`
- **Security & Reliability**:
  - Raw tokens are 32-byte cryptographically secure random values (`randomToken(32)`).
  - Stored exclusively as SHA-256 hashes (`hashToken(rawToken)`).
  - 1-hour expiration window.
  - Previous unused tokens for the same user are immediately invalidated upon new recovery request.
  - Simulation mode active in tests or when `RESEND_API_KEY` is omitted, avoiding outbound network calls.

### 3.3. Endpoint Contracts

1. **`POST /api/auth/password-recovery`**:
   - Accepts `{ email: string }`.
   - Rate limited per IP/email.
   - Always returns `{ ok: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em poucos minutos." }` regardless of whether the email exists.
2. **`POST /api/auth/password-reset`**:
   - Accepts `{ token: string, password: string }`.
   - Validates token hash, expiration, and unused status.
   - Enforces password policy (`assertNewPasswordOk`).
   - Updates password hash, sets `mustChangePassword = false`, marks token used, and revokes all active user sessions atomically in a transaction.
3. **`GET /api/settings/company` & `PATCH /api/settings/company`**:
   - Validates IANA timezone allowlist against `Intl.DateTimeFormat`.
   - Restricted to workspace `OWNER` and `ADMIN`.
4. **`POST /api/members/:id/reset-password`**:
   - Restricted to `OWNER` (or `ADMIN` resetting `MEMBER`s).
   - Generates random temporary password, marks `mustChangePassword = true`, revokes active sessions, and returns clear temporary credential once for administrative handoff.

---

## 4. Frontend Implementation Details

1. **Password Recovery & Reset Pages**:
   - [Recovery.tsx](file:///opt/looply/frontend/src/features/Recovery.tsx): Implements Figma 05.1 recovery layout using shared `AuthShell` and semantic typography tokens.
   - [ResetPassword.tsx](file:///opt/looply/frontend/src/features/ResetPassword.tsx): Extracts token from URL parameters, validates password length and confirmation match, and displays success state with auto-redirect to `/login`.
   - [Login.tsx](file:///opt/looply/frontend/src/features/Login.tsx): Updated "Esqueci minha senha" link targeting `/forgot-password`.
2. **App Shell & Navigation Revisions**:
   - [Sidebar.tsx](file:///opt/looply/frontend/src/components/Sidebar.tsx): Clickable brand logo linking to `/dashboard`. Bottom user card opens popover menu (`Minha conta`, `Configurações`, `Sair do Looply`).
   - [AppLayout.tsx](file:///opt/looply/frontend/src/components/AppLayout.tsx): Cohesive mobile and desktop shell with proper link semantics.
3. **Dashboard Greeting**:
   - [Dashboard.tsx](file:///opt/looply/frontend/src/features/Dashboard.tsx): Dynamic greeting resolving `Bom dia` / `Boa tarde` / `Boa noite` with the logged-in user's first name from `useMe()`.
4. **Calendar Interactive Creation**:
   - [Calendar.tsx](file:///opt/looply/frontend/src/features/Calendar.tsx): Clicking any active month day cell opens `openCreateModal(cell)` with the clicked date pre-selected, while item clicks call `e.stopPropagation()`.
5. **Team Security Actions**:
   - [Team.tsx](file:///opt/looply/frontend/src/features/Team.tsx): Added `Redefinir acesso` button with temporary password modal, copy-to-clipboard functionality, and active session termination notice.
6. **Company Settings Tab**:
   - [Settings.tsx](file:///opt/looply/frontend/src/features/Settings.tsx): Full company settings editor with name input and timezone selection.

---

## 5. Verification & Test Evidence

### Backend Test Suite
```bash
npm --prefix backend run typecheck && npm --prefix backend run test
```
- **Typecheck**: Clean pass (`0 errors`).
- **Tests**: **34 test files, 394 tests passed** (including new `tests/passwordRecovery.test.ts` and `tests/settingsAndCredentials.test.ts`).

### Frontend Test Suite
```bash
npm --prefix frontend run typecheck && npm --prefix frontend run test
```
- **Typecheck**: Clean pass (`0 errors`).
- **Tests**: **15 test files, 199 tests passed** (including new `src/tests/recovery.test.tsx` and updated `src/tests/login.test.tsx`, `src/tests/shell.test.tsx`).

### Production Builds
```bash
npm --prefix frontend run build
npm --prefix backend run build
```
- Both frontend and backend bundles compile cleanly for production.

---

## 6. Final Status

FIGMA → RUNTIME RECONCILIATION — READY FOR ACTIVATION
