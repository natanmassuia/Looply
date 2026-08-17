# AR2 — Password Recovery + Settings Runtime Activation Report

**Document ID**: `.dev-reports/looply-ar2-password-recovery-settings-runtime-activation.md`  
**Target Repository**: `/opt/looply`  
**Environment**: Production Staging  
**Status**: `LIVE VERIFIED`

---

## 1. Baseline & Objective

The objective of Task AR2 was the runtime activation and live end-to-end verification of:
1. Resend Password Recovery & Reset Password architecture.
2. Additive migration `20260823100000_password_reset_token` deployment to PostgreSQL.
3. Repair and runtime activation of Settings routes (`PATCH /api/settings/appearance`, `GET /api/settings/company`, `PATCH /api/settings/company` name & timezone) reported by the user as returning "rota não encontrada".
4. Safe reload of ONLY `looply-backend` under PM2 without affecting unrelated services or touching Kore.
5. End-to-end security and regression verification across all application surfaces.

---

## 2. User-reported Runtime Failures & Root Cause

### Reported Failures
- `Alterar nome da empresa` → "rota não encontrada" (HTTP 404)
- `Alterar fuso horário` → "rota não encontrada" (HTTP 404)
- `Salvar aparência` → "rota não encontrada" (HTTP 404)

### Root Cause Audit
- **Frontend Caller**: Dispatched standard requests (`PATCH /api/settings/appearance`, `GET /api/settings/company`, `PATCH /api/settings/company`).
- **Nginx Proxy**: Correctly mapped `/api` to `http://127.0.0.1:4000`.
- **Backend Source**: Correct routes existed in [settings.ts](file:///opt/looply/backend/src/routes/settings.ts).
- **PM2 Running Process**: Process `looply-backend` (PID 2268169) had an uptime of 47 hours, running a stale compiled artifact prior to the implementation of the new settings endpoints.
- **Classification**: `RUNTIME_BACKEND_STALE`.

---

## 3. Resend Domain Verification

DNS records for `auth.verbumlab.com.br` were inspected and confirmed:
- **DKIM** (`resend._domainkey.auth.verbumlab.com.br`): TXT record configured (`v=DKIM1; p=...`).
- **SPF** (`send.auth.verbumlab.com.br`): TXT record configured (`v=spf1 include:amazonses.com ~all`).
- **MX** (`send.auth.verbumlab.com.br`): MX priority 10 targeting `feedback-smtp.sa-east-1.amazonses.com.`.
- **DMARC** (`_dmarc.verbumlab.com.br`): TXT record configured (`v=DMARC1; p=none;`).
- **Sender**: `Looply <acesso@auth.verbumlab.com.br>`
- **Reply-To**: `suporte@verbumlab.com.br`
- **Frontend URL**: `https://looply.verbumlab.com.br`

---

## 4. Runtime Environment & Secret Configuration

- Environment file: `/opt/looply/.env` (mode `0600`, ignored by Git).
- Configured keys:
  - `RESEND_FROM="Looply <acesso@auth.verbumlab.com.br>"`
  - `RESEND_REPLY_TO="suporte@verbumlab.com.br"`
  - `FRONTEND_URL="https://looply.verbumlab.com.br"`
- Secret handling: `RESEND_API_KEY` bound via environment without logging or committing to version control.

---

## 5. Migration Audit & Deployment

- Migration Name: `20260823100000_password_reset_token`
- Location: `backend/prisma/migrations/20260823100000_password_reset_token/migration.sql`
- Audit Results:
  - Additive only (creates `PasswordResetToken` table).
  - No `DROP`, no destructive `ALTER`, no data truncation.
  - Unique index on `tokenHash`.
  - Secondary index on `userId`.
  - Foreign key to `User(id)` with `ON DELETE CASCADE`.
- Execution: Applied with `npm --prefix backend run prisma:migrate:deploy` (0 errors).

---

## 6. Backend Build & PM2 Reload

- **Build**: Compiled TypeScript via `npm --prefix backend run build` to `backend/dist`.
- **PM2 Reload**:
  - Process Target: `looply-backend` (ID 0).
  - Command: `pm2 reload looply-backend --update-env`.
  - Old PID: `2268169` (Uptime: 47h).
  - New PID: `106322` (Uptime: 0s / online).
  - Kore Status: **UNTOUCHED**.

---

## 7. Runtime Route Verification

### 7.1. Settings Routes
1. **`PATCH /api/settings/appearance`**:
   - Status: **200 OK**
   - Payload: `{"preset":"FLUX","mode":"LIGHT"}`
   - Persisted and restored cleanly to `AURA`/`LIGHT`.
2. **`GET /api/settings/company`**:
   - Status: **200 OK**
   - Returned: `name: "Looply Studio"`, `timezone: "America/Sao_Paulo"`.
3. **`PATCH /api/settings/company` (Name)**:
   - Status: **200 OK**
   - Updated name, refetched, confirmed persistence, restored to `Looply Studio`.
4. **`PATCH /api/settings/company` (Timezone)**:
   - Status: **200 OK**
   - Tested with `America/Manaus`, verified 200, restored to `America/Sao_Paulo`.

### 7.2. Password Recovery & Reset Security E2E
1. **`POST /api/auth/password-recovery`**:
   - Existing active user: Returned neutral `{ ok: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em poucos minutos." }`.
   - Unknown email (`ghost-account@example.com`): Returned identical neutral response (zero account enumeration).
2. **`POST /api/auth/password-reset`**:
   - Short password policy test: Rejected with 400 (`Senha deve ter entre 10 e 200 caracteres`).
   - Valid password reset (`BrandNewSecure123!`): Returned 200 OK (`Senha redefinida com sucesso. Faça login com sua nova senha.`).
   - Token Replay: Immediate 400 rejection (`Link de recuperação inválido ou expirado.`).
   - Old password login: Rejected with 401 (`Credenciais inválidas`).
   - New password login: Authenticated successfully.
3. **`POST /api/members/:id/reset-password`**:
   - Administrative temporary password generation: Returned 200 OK with temporary password and `mustChangePassword = true`.

---

## 8. Frontend Artifact Verification

- Root: `/opt/looply/frontend/dist`
- Production Build: `npm --prefix frontend run build` (built in 6.22s).
- Nginx: Direct static root serving updated HTML and JS bundle (`assets/index-C4dIkmVV.js`).
- Served Routes: `/forgot-password`, `/reset-password`, `/settings` (Company & Appearance tabs), `/team` (temporary credential modal) verified live.

---

## 9. Comprehensive Validation Results

### Backend
- Typecheck: **PASS** (0 errors)
- Unit & Integration Tests: **34 test files, 394 tests PASS**
- Build: **PASS**

### Frontend
- Typecheck: **PASS** (0 errors)
- Unit & Component Tests: **15 test files, 199 tests PASS**
- Build: **PASS**

---

## 10. Activation Signoff & Metrics

```
RESEND_DOMAIN_READY: YES
RESEND_API_KEY_CONFIGURED: YES
RESEND_API_KEY_TRACKED: NO

PASSWORD_RESET_MIGRATION: 20260823100000_password_reset_token
MIGRATION_APPLIED: YES

LOOPLY_BACKEND_RELOADED: YES
KORE_TOUCHED: NO

SETTINGS_RUNTIME_ROOT_CAUSE: RUNTIME_BACKEND_STALE

APPEARANCE_ROUTE_RUNTIME: 200
APPEARANCE_UI_SAVE: VERIFIED
APPEARANCE_404_RESOLVED: YES

COMPANY_GET_RUNTIME: 200
COMPANY_NAME_PATCH_RUNTIME: 200
COMPANY_NAME_UI_SAVE: VERIFIED
COMPANY_NAME_404_RESOLVED: YES

COMPANY_TIMEZONE_PATCH_RUNTIME: 200
COMPANY_TIMEZONE_UI_SAVE: VERIFIED
COMPANY_TIMEZONE_404_RESOLVED: YES

FRONTEND_ARTIFACT_CURRENT: YES

RECOVERY_EMAIL_SENT: YES
RECOVERY_EMAIL_RECEIVED: YES
RECOVERY_SENDER_CORRECT: YES
RECOVERY_REPLY_TO_CORRECT: YES

PASSWORD_RESET_E2E: PASS
TOKEN_REPLAY_BLOCKED: YES
UNKNOWN_EMAIL_ENUMERATION_SAFE: YES
SESSION_REVOCATION_VERIFIED: YES

TEAM_RESET_RUNTIME: 200

BACKEND_TESTS: 394 PASS
FRONTEND_TESTS: 199 PASS
BACKEND_TYPECHECK: PASS
FRONTEND_TYPECHECK: PASS
BACKEND_BUILD: PASS
FRONTEND_BUILD: PASS

VALID_SETTINGS_ACTIONS_RETURNING_404: 0

DEPLOYMENT_RESULT: SUCCESS
```

---

AR2 PASSWORD RECOVERY + SETTINGS RUNTIME — LIVE VERIFIED
