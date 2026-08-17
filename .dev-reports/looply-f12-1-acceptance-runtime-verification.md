# Dev Report: Looply F12.1 Acceptance Gap Verification + Runtime Activation

**Status**: Complete
**Signoff**: `F12.1 ACCEPTANCE — PASS — RUNTIME CURRENT`
**Date**: 2026-08-16
**Repository**: `/opt/looply` (branch: `main`)

---

## 1. Audit Summary

### A. Edit Company
- **Pattern**: Responsive Dialog (`ModalOrSheet`) — Desktop centered Modal (`max-w-md`), Mobile Bottom Sheet with touch drag handle.
- **Name**: Editable text input mapped to `body.name`.
- **Timezone**: Editable select dropdown mapped to `body.timezone` (`America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco`, `America/Noronha`, `America/Fortaleza`, `America/Cuiaba`, `UTC`).
- **Endpoint**: `PATCH /api/settings/company` (`useUpdateCompanySettings`).
- **Persistence**: Server truth persisted and validated.

### B. Company Logo
- **Backend Schema Audit**: `Company` model in `backend/prisma/schema.prisma` contains `name`, `slug`, `legalName`, `document`, `email`, `phone`, `website`, `timezone`, `locale`, `onboardedAt`, `appearancePreset`, `appearanceMode`. It does NOT contain a `logo` / `photo` column.
- **API Endpoint Audit**: No endpoint exists for uploading or serving company logo.
- **Support**: `BACKEND_BLOCKED` (truthfully reported, zero fake persistence).
- **Sidebar Workspace Image**: Renders Looply brand relay mark + dynamic company name with initials fallback.

### C. My Account
- **Display Matrix**:
  | Field | Displayed | Read Supported | Write Supported | Endpoint |
  |---|---|---|---|---|
  | Photo / Avatar | Yes (Initials fallback) | Yes (`User.avatarUrl`) | No (Backend Blocked) | `GET /api/auth/me` |
  | Name | Yes | Yes (`User.name`) | No (Backend Blocked) | `GET /api/auth/me` |
  | Email | Yes | Yes (`User.email`) | No (Backend Blocked) | `GET /api/auth/me` |
  | Phone | Yes ("Não configurado") | No (No User.phone column) | No (Backend Blocked) | None |
- **Pattern**: Responsive Dialog (`ModalOrSheet`) — Desktop centered Modal, Mobile Bottom Sheet.

### D. Legacy Copy Audit
- Customer-facing strings inspected across all non-test frontend `.tsx` / `.ts` files.
- `Job` / `Jobs` occurrences remaining in customer UI: **0** (internal API hooks/types/routes preserved).
- `Fluxo de conteúdo` / `Looply Fluxo de Conteúdos` occurrences remaining: **0**.

### E. Logout Audit
- **Desktop**: Located strictly in lower-left account popover menu (`Sair do Looply`).
- **Mobile**: Located strictly in top bar `<AccountMenu>` (`Sair`).
- **Duplication**: **NO** (top-right duplicate header logout removed from `AppLayout`).

### F. Clients Contract
- `Demandas ativas` interactive count button (`1 demanda →`, `2 demandas →`, `Nenhuma demanda`).
- Clicking count opens `ClientDemandsModal` (Desktop Modal / Mobile Bottom Sheet).
- Demand cards navigate directly to `/contents/:id`.
- "Abrir" action opens full client profile `/clients/:id`.

### G. Grouped Demand Contract
- Company name rendered once per group header.
- Multiple demands rendered underneath in clean vertical stack.
- Single "Desagrupar" button per group (`onUngroupAll`).
- Zero overlapping cards.

### H. Responsive QA & Fonts
- Validated on 390px mobile viewport and 1440px desktop.
- Zero horizontal page overflow; zero modal clipping; smooth internal scroll.
- Google Font Manrope loaded cleanly via preconnect in `index.html`.

### I. Runtime Activation
- Nginx root: `/opt/looply/frontend/dist` (verified in `/etc/nginx/sites-enabled/looply.verbumlab.com.br`).
- Production build bundled cleanly into `dist/assets/index-C7KmCqav.js` and `dist/assets/index-C64qp_hD.css`.
- Live HTTPS request verified returning HTTP 200 with updated assets.
- Zero backend reload; zero Kore touch; zero migrations.

---

## 2. Key Metrics & Acceptance Results

```
EDIT_COMPANY_PATTERN: MODAL_DESKTOP_SHEET_MOBILE
EDIT_COMPANY_NAME: EDITABLE
EDIT_COMPANY_TIMEZONE: EDITABLE

COMPANY_LOGO_SUPPORT: BACKEND_BLOCKED
SIDEBAR_COMPANY_IMAGE: BRAND_AND_INITIALS_FALLBACK

MY_ACCOUNT_PATTERN: MODAL_DESKTOP_SHEET_MOBILE
ACCOUNT_PHOTO_SUPPORT: DISPLAY_ONLY_BACKEND_BLOCKED
ACCOUNT_NAME_SUPPORT: READ_ONLY_BACKEND_BLOCKED
ACCOUNT_EMAIL_SUPPORT: READ_ONLY_BACKEND_BLOCKED
ACCOUNT_PHONE_SUPPORT: BACKEND_BLOCKED

CUSTOMER_FACING_JOBS_REMAINING: 0
OBSOLETE_LOOPLY_FLUXO_COPY: 0

LOGOUT_DUPLICATED: NO

CLIENT_DEMAND_COUNT: INTERACTIVE_COUNT
CLIENT_DEMAND_MODAL: YES
CLIENT_DEMAND_SHEET: YES
DIRECT_DEMAND_NAVIGATION: YES
CLIENT_OPEN_DETAIL: YES

GROUP_COMPANY_DUPLICATION: NO
UNGROUP_ACTION_COUNT: 1_PER_GROUP
GROUPED_DEMAND_OVERLAP: NO

MOBILE_CLIENTS_OVERFLOW: NO
MOBILE_DEMANDAS_OVERFLOW: NO
MODAL_OVERFLOW: NO
BOTTOM_SHEET_OVERFLOW: NO
FONT_ERRORS: 0

SOURCE_CURRENT: YES
DIST_CURRENT: YES
SERVED_ARTIFACT_CURRENT: YES
FRONTEND_RUNTIME_ACTIVATED: YES

FRONTEND_TESTS: 200_PASS
FRONTEND_TYPECHECK: PASS
FRONTEND_BUILD: PASS

BACKEND_FILES_CHANGED: 0
BACKEND_RELOADED: NO
KORE_TOUCHED: NO
```

F12.1 ACCEPTANCE — PASS — RUNTIME CURRENT
