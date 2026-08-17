# Dev Report: Looply F12.2 Settings Profile/Company Data Completion + Client Detail Navigation Repair

**Status**: Complete
**Signoff**: `F12.2 PROFILE + COMPANY + CLIENT NAVIGATION — LIVE VERIFIED`
**Date**: 2026-08-16
**Repository**: `/opt/looply` (branch: `main`)

---

## 1. Baseline
- **Git Commit**: `8487e4a14a9adf925021ebc6eb9b8bf007004c98`
- **Frontend Baseline**: 200 tests PASS (15 files)
- **Backend Baseline**: 394 tests PASS (34 files)
- **Reported Issues**:
  1. Settings lacked user personal profile management (Minha Conta) and complete institutional company data (Telefone empresarial / Business Phone, Logo).
  2. Clicking "Abrir" on Client card redirected to `/dashboard` instead of opening the full Client Detail page.

---

## 2. User Reported Issues

### Issue 1: Incomplete Settings & Identity Data
- **Personal Profile (Minha Conta)**: User needed self-service management of personal name, personal phone, email, and avatar/photo.
- **Company Institutional Data**: Company profile needed institutional business phone (`phone`) and company logo URL (`logoUrl`), distinct from Meta/WhatsApp integration credentials.
- **Phone Domain Separation**: Strict separation between:
  - Personal phone (`User.phone`) -> Minha conta
  - Business phone (`Company.phone`) -> Configurações > Empresa
  - WhatsApp/Meta number (`WhatsAppIdentity` / integration) -> Configurações > Integrações

### Issue 2: Client Card "Abrir" Redirect to Dashboard
- Clicking "Abrir" on a client card navigated to `/clients/:id`.
- The route `/clients/:id` was missing from `App.tsx`, triggering the fallback wildcard `<Route path="*" element={<Navigate to="/dashboard" replace />} />`.

---

## 3. Root Cause Analysis & Architecture

### Client Navigation Root Cause
- **Classification**: `ROUTE_MISSING`
- **Root Cause**: `frontend/src/App.tsx` defined `<Route path="/clients" element={<Clients />} />` but lacked a route handler for `/clients/:id`. Navigating to `/clients/:id` matched `path="*"` which redirected to `/dashboard`.
- **Resolution**:
  - Implemented `frontend/src/features/ClientDetail.tsx` with complete client overview, contact info, channels, active demands list, and edit/delete actions.
  - Added `<Route path="/clients/:id" element={<ClientDetail />} />` inside the authenticated `AppLayout` route group in `App.tsx`.
  - Added `useClient(id)` hook to `frontend/src/lib/api.ts`.

### Settings & Identity Architecture
- **Information Architecture**:
  - `Minha conta`: Displays current user identity, name, email, personal phone, avatar/photo, and security options with unified `MyAccountModal` editor.
  - `Empresa`: Displays company name, institutional business phone (`Telefone empresarial`), company logo URL, and canonical IANA timezone.
  - `Aparência`: Palettes (Aura, Flux, Pulse, Custom) and Light/Dark display modes.
  - `Integrações`: WhatsApp Cloud API / Meta integration (isolated).
- **Backend Changes**:
  - Added `phone String?` to `model User` in `backend/prisma/schema.prisma`.
  - Added `logoUrl String?` to `model Company` in `backend/prisma/schema.prisma`.
  - Created additive migration `20260824100000_user_phone_company_logo`.
  - Implemented `PATCH /api/auth/me` with name validation, phone normalization, email uniqueness enforcement (409 conflict on collision), and avatarUrl support.
  - Updated `GET /api/auth/me` to return `phone` and `avatarUrl`.
  - Updated `GET /api/settings/company` and `PATCH /api/settings/company` to read and write `phone` (business phone) and `logoUrl`.

---

## 4. Phone Domain Separation Matrix

| Concept | Owner | Database Storage | Endpoint | UI Location |
|---|---|---|---|---|
| **Personal Phone** | User | `User.phone` | `PATCH /api/auth/me` | Minha conta / Account Modal |
| **Business Phone** | Company | `Company.phone` | `PATCH /api/settings/company` | Configurações > Empresa |
| **WhatsApp/Meta Phone** | Integration | `WhatsAppIdentity` | WhatsApp Integration routes | Configurações > Integrações |

---

## 5. Verification & Testing

### Backend Tests
- `backend/tests/settingsAndCredentials.test.ts`: Added tests for user profile self-service update and company business phone/logo updates.
- Total test files: **34**
- Total tests: **396 PASS** (0 failed)

### Frontend Tests
- `frontend/src/tests/settings.test.tsx`: Added comprehensive tests for Minha conta tab, profile editing via `MyAccountModal`, and Empresa institutional phone/logo saving.
- `frontend/src/tests/clients.test.tsx`: Added tests for "Abrir" action linking directly to `/clients/:id`.
- Total test files: **16**
- Total tests: **204 PASS** (0 failed)

### Runtime & Build
- `looply-backend` reloaded cleanly via PM2 (id 0).
- Frontend production bundle built to `dist/assets/index-CItWuvOD.js` and `dist/assets/index-BOLgf8y7.css`.
- Live HTTPS request verified with HTTP 200 on `https://looply.verbumlab.com.br`.
- Kore was **NOT** touched.

---

## 6. Required Signoff Metrics

```
MY_ACCOUNT_SETTINGS_ENTRY: YES
MY_ACCOUNT_PATTERN: TAB_AND_RESPONSIVE_MODAL_SHEET

USER_PHOTO: SUPPORTED_URL_AND_INITIALS
USER_NAME_EDIT: PERSISTED
USER_EMAIL_EDIT: PERSISTED_WITH_UNIQUENESS
USER_PHONE_EDIT: PERSISTED

COMPANY_LOGO: SUPPORTED_URL_AND_INITIALS
COMPANY_NAME_EDIT: PERSISTED
COMPANY_BUSINESS_PHONE_EDIT: PERSISTED
COMPANY_TIMEZONE_EDIT: PERSISTED

BUSINESS_PHONE_META_COUPLED: NO
BUSINESS_PHONE_WHATSAPP_COUPLED: NO

CLIENT_OPEN_ROOT_CAUSE: ROUTE_MISSING
CLIENT_OPEN_ROUTE: /clients/:id
CLIENT_OPEN_RUNTIME: LIVE_VERIFIED
CLIENT_DETAIL_REFRESH: STAYS_ON_CLIENT_DETAIL
CLIENT_OPEN_DASHBOARD_REGRESSION: NO

CLIENT_DEMAND_MODAL_RUNTIME: YES
DIRECT_DEMAND_NAVIGATION: YES

BACKEND_FILES_CHANGED: 4
PRISMA_SCHEMA_CHANGED: YES
MIGRATION_CREATED: YES
MIGRATION_APPLIED: YES
LOOPLY_BACKEND_RELOADED: YES

FRONTEND_TESTS: 204_PASS
BACKEND_TESTS: 396_PASS
FRONTEND_TYPECHECK: PASS
BACKEND_TYPECHECK: PASS
FRONTEND_BUILD: PASS
BACKEND_BUILD: PASS

META_INTEGRATION_FILES_CHANGED: NO
WHATSAPP_PROVIDER_FILES_CHANGED: NO
KORE_TOUCHED: NO
```

F12.2 PROFILE + COMPANY + CLIENT NAVIGATION — LIVE VERIFIED
