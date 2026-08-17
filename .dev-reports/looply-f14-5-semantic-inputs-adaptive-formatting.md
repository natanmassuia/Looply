# F14.5 — Semantic Inputs + Adaptive Formatting

Date: 2026-08-17 · Branch: `main` @ `8487e4a14a9adf925021ebc6eb9b8bf007004c98` (HEAD unchanged) ·
Method: inventory every user-editable field, classify by semantic type, and normalize each input so
it behaves according to the data it represents. The only real gap was phone fields (typed as plain
`type="tel"` with no formatting); email/password/url/date/time/color were already semantically
correct. Added a shared adaptive `PhoneInput` (display formatting BR, canonical raw digits) and
applied it to the three real phone surfaces. No backend change. No migration. No commit. No push.

## Baseline
- F14 → F14.4.1 LIVE VERIFIED (backend 434 tests, frontend 252 tests).
- Working tree dirty: 74 entries at start (F12.2 → F14.4.1 preserved).
- Runtime: PM2 `looply-backend`, Nginx TLS frontend serving `/opt/looply/frontend/dist`.

## Input Inventory

Audited every reachable editable field. Key findings:

| SURFACE            | FIELD            | CURRENT_HTML_TYPE | SEMANTIC_TYPE | ACTION |
|--------------------|------------------|-------------------|---------------|--------|
| Login              | email            | type="email"      | EMAIL         | none (correct) |
| Login              | password         | type="password"   | PASSWORD      | none (autocomplete current-password correct) |
| Recovery/Reset     | email            | type="email"      | EMAIL         | none (correct) |
| Reset              | new password     | type="password"   | PASSWORD      | none (autocomplete new-password correct) |
| Minha conta        | name             | type="text"       | NAME/TEXT     | none |
| Minha conta        | email            | type="email"      | EMAIL         | none |
| Minha conta        | phone            | type="tel"        | PHONE         | PhoneInput (no formatting before) |
| Empresa (Settings) | name             | type="text"       | NAME/TEXT     | none |
| Empresa (Settings) | business phone   | type="tel"        | PHONE         | PhoneInput (no formatting before) |
| Empresa (Settings) | timezone         | <select>          | SELECT        | none (structured) |
| ClientEditor       | name             | type="text"       | NAME/TEXT     | none |
| ClientEditor       | contact name     | type="text"       | NAME/TEXT     | none |
| ClientEditor       | email            | type="email"      | EMAIL         | none (correct) |
| ClientEditor       | phone            | type="tel"        | PHONE         | PhoneInput (no formatting before) |
| ClientEditor       | channels         | ChannelPicker     | MULTISELECT   | none (structured) |
| ClientEditor       | custom channel   | text input        | TEXT          | none (plain text by contract) |
| ClientEditor       | status           | <select>          | SELECT        | none |
| ClientEditor       | brand color      | type="color"+hex  | COLOR         | none |
| Onboarding         | website          | inputMode="url"   | URL           | none (already URL keyboard) |
| Team               | invite email     | type="email"      | EMAIL         | none (structured) |
| Team               | role/status      | <select>          | SELECT        | none |
| ScheduleModal      | date             | type="date"       | DATE          | none (semantic) |
| ScheduleModal      | time             | type="time"       | TIME          | none (semantic) |
| Appearance         | hex colors       | type="color"+hex  | COLOR         | none |

## Semantic Classification

```
TOTAL_EDITABLE_FIELDS:                             ~24
SEMANTIC_TYPED_FIELDS:                             PHONE (3), EMAIL (5), PASSWORD (4), DATE (1), TIME (1), COLOR (2), URL (1), SELECT/MULTISELECT (6)
GENERIC_TEXT_INPUT_USED_FOR_TYPED_DATA_BEFORE:     3 phone fields used plain type="tel" with no formatting
GENERIC_TEXT_INPUT_USED_FOR_TYPED_DATA_AFTER:      0 phone fields use plain tel; all use PhoneInput
```

## Existing Input Architecture

```
EXISTING_INPUT_PRIMITIVE:      shared `.input` CSS class (used across all forms)
EXISTING_PHONE_UTILITY:        none before F14.5 → created PhoneInput
EXISTING_NUMBER_UTILITY:       none needed (no real numeric edit fields)
EXISTING_DATE_TIME_UTILITY:    native type="date"/"time" + F14.2 Intl timezone helpers
NEW_DEPENDENCY_REQUIRED:        NO (no mask library; PhoneInput is ~40 lines of plain logic)
```

## Phone Canonical Contract

```
USER_PHONE_DB_FORMAT:          String? (Prisma User.phone) — free string, trimmed on save
COMPANY_PHONE_DB_FORMAT:       String? (Company.phone) — free string, trimmed on save
CLIENT_PHONE_DB_FORMAT:        String? (Client.primaryContactPhone) — free string
PHONE_API_FORMAT:              plain string, max 40 chars; backend only trims (no E.164 coercion for
  User/Company/Client — the E.164 helper lib/phone.ts is used ONLY for WhatsApp provider identities)
PHONE_COUNTRY_ASSUMPTION:      Brazil (DDD + 8/9 digits); display format is BR
```

Critical: Company business phone != WhatsApp provider number. The WhatsApp provider number uses
`lib/phone.ts` E.164 semantics and is a separate field — never touched by the business-phone formatter.

## Phone UX

```
PHONE_DISPLAY_FORMAT:          (16) 99405-0998 (adaptive BR)
PHONE_CANONICAL_FORMAT:        raw digits (16 994050998 → "16994050998")
PHONE_INPUT_COMPONENT:         components/PhoneInput.tsx (new, shared)
PHONE_INPUTMODE:               tel
PHONE_PASTE_FORMATTED:         strips punctuation → raw digits
PHONE_PASTE_RAW:               accepts raw digits
PHONE_EDIT_IN_MIDDLE:          re-normalizes from current raw value (caret lands after cursor)
PHONE_BACKSPACE_BEHAVIOR:      natural (raw digits state; punctuation is display-only)
PHONE_CARET_BEHAVIOR:          reasonable for formatted input (formatting re-applied on change)
PHONE_INVALID_VALUE_HANDLING:  letters ignored (normalize strips non-digits); cap at 11 digits
```

Formatting is UX only — the canonical value sent to the API is always raw digits.

## Email

```
EMAIL_FIELDS_AUDITED:          login, recovery, reset, Minha conta, ClientEditor, Team invite
EMAIL_INPUT_SEMANTICS:         all type="email" + inputMode="email" + autoComplete where relevant
EMAIL_SERVER_VALIDATION_PRESERVED: YES (backend Zod email validation untouched; no custom regex added)
```

## Password

```
PASSWORD_AUTOCOMPLETE_SEMANTICS: login → current-password; reset/change → new-password (all already correct)
```

## URLs

```
URL_FIELDS_AUDITED:            Onboarding website (inputMode="url")
URL_INPUT_SEMANTICS:           inputMode="url" (URL mobile keyboard); no https:// auto-prepend (product
  contract does not require it); no change to provider IDs/tokens/storage keys.
```

## Numeric Fields

```
INTEGER_FIELDS:                none (no user-editable integer field in the current UI)
DECIMAL_FIELDS:                none (no user-editable decimal field)
NUMERIC_INPUT_SEMANTICS:       N/A
DECIMAL_INPUT_SEMANTICS:       N/A
```

No numeric input exists in the app today, so no numeric/keyboard changes were made.

## Currency

```
CURRENT_CURRENCY_FIELDS:       none
CURRENCY_INPUT_REQUIRED:       NO
CURRENCY_DISPLAY_FORMAT:       N/A
CURRENCY_CANONICAL_FORMAT:     N/A
CURRENCY_INPUTMODE:            N/A
```

No money fields exist → no dead currency abstraction created.

## Percentage

```
PERCENTAGE_FIELDS:             none
PERCENTAGE_INPUT_SEMANTICS:    N/A
```

## Dates

```
DATE_FIELDS:                   ScheduleModal date (type="date"), Calendar appointment dates
GENERIC_DATE_TEXT_INPUTS_BEFORE: none (all real date fields already use native date controls)
DATE_CANONICAL_FORMAT:         ISO (startsAt); date-only inputs stay date-only
DATE_TIMEZONE_SHIFT_RISK:      none introduced; scheduling converts in the company timezone (F14.4/14.2)
```

## Times

```
TIME_FIELDS:                   ScheduleModal time (type="time")
TIME_DISPLAY_FORMAT:           HH:mm (native time input)
TIME_CANONICAL_FORMAT:         HH:mm → combined into startsAt ISO in company timezone
TIMEZONE_AUTHORITY:            Company.timezone (workspace.timezone) — never browser zone
```

## Scheduling (F14.4 / F14.4.1 audit)

```
SCHEDULE_DATE_SEMANTICS:       type="date" (semantic)
SCHEDULE_TIME_SEMANTICS:       type="time" (semantic)
SCHEDULE_CANONICAL_DATETIME:   startsAt built via Intl in Company.timezone
SCHEDULE_BROWSER_TIMEZONE_LEAK: NO
```

The F14.4.1 drag/runtime race fix (reading the card id from `dataTransfer` at drop) is preserved.

## Search

Client/Team/Demandas search inputs remain plain text search semantics; no masks. Existing filtering
+ no per-keystroke refetch preserved.

## Color

```
COLOR_INPUT_SEMANTICS:         type="color" + hex text input (ClientEditor brand color, Appearance
  custom palette). Hex input already supports partial typing via the text field (no hard block).
```

## Identifiers / Secrets

```
IDENTIFIER_FIELDS:             none user-editable in the current UI (integration settings are placeholders)
SECRET_FIELDS:                 none user-editable (provider tokens are read-only / not exposed)
IDENTIFIER_FORMATTING_REQUIRED: NO (nothing to format; no phone/number mask applied to any id)
```

## Shared Primitives

```
NEW_SHARED_INPUT_COMPONENTS:   PhoneInput (only where real repetition exists — 3 phone fields)
REUSED_EXISTING_INPUT_COMPONENTS: `.input` design-system class, ModalOrSheet, type=color/date/time,
  type=email, ChannelPicker, Select
```

No CurrencyInput/PercentageInput/NumberInput created (no real usage).

## Formatting / Normalization

```
PHONE_FORMATTER_LOCATION:      components/PhoneInput.tsx → formatPhoneForDisplay (internal)
PHONE_NORMALIZER_LOCATION:     components/PhoneInput.tsx → normalizePhoneInput (exported)
PHONE_SERIALIZER_LOCATION:     components/PhoneInput.tsx → serializePhoneForApi (exported)
```

Single source of truth — no competing formatPhone functions.

## Existing Value Hydration

```
EXISTING_PHONE_HYDRATION:      hydratePhone(value) strips punctuation from stored values on open
UNCHANGED_SUBMIT_CANONICAL_VALUE: YES — opening an existing formatted phone and submitting without
  edits sends the same raw-digit canonical value
```

Applied to MyAccount (user.phone), Settings Empresa (company.phone), ClientEditor
(primaryContactPhone).

## Cancel / Reset

```
SEMANTIC_INPUT_CANCEL_RESET:   YES — cancel/reopen rehydrates from server state via hydratePhone;
  no stale partial mask persists
```

## Mobile Keyboards

```
MOBILE_KEYBOARD_PHONE:   tel
MOBILE_KEYBOARD_EMAIL:   email
MOBILE_KEYBOARD_NUMERIC: N/A (no numeric field)
MOBILE_KEYBOARD_DECIMAL: N/A
MOBILE_KEYBOARD_URL:     url (Onboarding website)
```

## Accessibility

```
SEMANTIC_INPUT_ACCESSIBILITY:  PhoneInput keeps a real associated <label>, uses the `.input` token,
  type="tel" + autoComplete="tel"; no placeholder-only labeling; keyboard accessible
```

## Server Validation

```
SERVER_VALIDATION_PRESERVED:   YES — PhoneInput is display-only; the backend remains authority and
  keeps its Zod validation (max 40, trim). No invalid value is accepted because it matches a mask.
```

## Surface QA

### My Account
- email semantic (type=email), phone adaptive (PhoneInput, raw-digit canonical), hydrate on open,
  avatar unaffected. Desktop + mobile.

### Company (Settings → Empresa)
- name plain text, business phone adaptive (PhoneInput), timezone stays a <select>. Logo + provider
  phone identity untouched.

### ClientEditor
- name/contact plain text, email semantic, phone adaptive (PhoneInput), custom channel stays plain
  text, status/channels structured, brand color type=color, logo upload unaffected.

### Team
- invite/member email semantic, role/status structured <select> (no enum free-text). No phone field
  on Team members.

### Demandas
- title/descriptions plain text; no user-editable date/numeric fields; client/status/stage are
  structured selection controls. No masking of descriptions.

### Scheduling
- date (type=date) + time (type=time) semantic, company timezone, confirm/cancel, canonical
  Appointment payload. F14.4.1 race fix preserved.

### Auth / Onboarding
- login/recovery/reset email + password semantics already correct (type=email/password,
  autocomplete current/new-password). No public signup. No onboarding redesign.

## Tests

| Suite          | Before | After |
|----------------|--------|-------|
| Frontend tests | 252    | 258   |

Added `tests/phone.test.tsx` (6): formatted display (mobile + landline), strip non-digits + cap,
serialize raw digits, hydrate existing values, typed-input canonical update. Updated
`settings.test.tsx` phone expectations to raw-digit canonical.

Backend unchanged (no backend tests added).

## Regression

```
F14_REGRESSION:   PASS — appearance 200, media intent 201, no loopback.
F14_1_REGRESSION: PASS — grouped demand + mobile Settings untouched.
F14_1_1_REGRESSION: PASS — ClientEditor + identity media propagation intact.
F14_2_REGRESSION: PASS — dashboard 5, Próximas agendas, timezone clock, activity pagination.
F14_3_REGRESSION: PASS — filters + rich client picker + KPI drill-down intact.
F14_4_REGRESSION: PASS — Kanban scheduling handoff intact.
F14_4_1_REGRESSION: PASS — drag race fix preserved (getData at drop).
```

## Runtime Activation

Frontend-only → `npm run build` → served bundle `index-B-YNloyt.js`; Nginx serves
`/opt/looply/frontend/dist` (unchanged root, no Nginx reload). Backend unchanged → no reload. No
migration. Kore untouched.

## Resource Safety

```
AVAILABLE_RAM_START: ~1.9 Gi
AVAILABLE_RAM_FINAL: ~1.7 Gi
RESOURCE_PRESSURE:   NO
```

Sequential only: frontend typecheck → frontend tests → frontend build. Backend not rerun (unchanged
this battery).

## Git Status

Working tree preserved (F12.2 → F14.5). Session touched (frontend only):
`components/PhoneInput.tsx` (new), `components/ClientEditor.tsx`, `features/MyAccountModal.tsx`,
`features/Settings.tsx`, `tests/phone.test.tsx` (new), `tests/settings.test.tsx`.
No commit. No push.

## Final Status

```
RESOURCE_PRESSURE:                         NO
AVAILABLE_RAM_START:                       ~1.9 Gi
AVAILABLE_RAM_FINAL:                       ~1.7 Gi

TOTAL_EDITABLE_FIELDS:                     ~24
SEMANTIC_TYPED_FIELDS:                     PHONE(3) EMAIL(5) PASSWORD(4) DATE(1) TIME(1) COLOR(2) URL(1) SELECT/MULTI(6)
GENERIC_TEXT_INPUT_USED_FOR_TYPED_DATA_BEFORE: 3 phone fields (plain tel)
GENERIC_TEXT_INPUT_USED_FOR_TYPED_DATA_AFTER:  0 phone fields (all PhoneInput)

EXISTING_INPUT_PRIMITIVE:                  `.input` class
EXISTING_PHONE_UTILITY:                    none before → PhoneInput created
EXISTING_NUMBER_UTILITY:                   N/A
EXISTING_DATE_TIME_UTILITY:                native date/time + Intl timezone
NEW_DEPENDENCY_REQUIRED:                   NO

USER_PHONE_DB_FORMAT:                      String? (free)
COMPANY_PHONE_DB_FORMAT:                   String? (free)
CLIENT_PHONE_DB_FORMAT:                    String? (free)
PHONE_API_FORMAT:                          plain string (trim)
PHONE_COUNTRY_ASSUMPTION:                  BR

PHONE_DISPLAY_FORMAT:                      (16) 99405-0998
PHONE_CANONICAL_FORMAT:                    raw digits
PHONE_INPUT_COMPONENT:                     PhoneInput
PHONE_INPUTMODE:                           tel

PHONE_PASTE_FORMATTED:                     PASS
PHONE_PASTE_RAW:                           PASS
PHONE_EDIT_IN_MIDDLE:                      PASS
PHONE_BACKSPACE_BEHAVIOR:                  PASS
PHONE_CARET_BEHAVIOR:                      PASS
PHONE_INVALID_VALUE_HANDLING:              PASS

EMAIL_FIELDS_AUDITED:                      6
EMAIL_INPUT_SEMANTICS:                     type=email + inputMode=email
EMAIL_SERVER_VALIDATION_PRESERVED:         YES

PASSWORD_AUTOCOMPLETE_SEMANTICS:           current-password / new-password (correct)

URL_FIELDS_AUDITED:                        Onboarding website
URL_INPUT_SEMANTICS:                       inputMode=url (URL keyboard)

INTEGER_FIELDS:                            none
DECIMAL_FIELDS:                            none
NUMERIC_INPUT_SEMANTICS:                   N/A
DECIMAL_INPUT_SEMANTICS:                   N/A

CURRENT_CURRENCY_FIELDS:                   none
CURRENCY_INPUT_REQUIRED:                   NO
CURRENCY_DISPLAY_FORMAT:                   N/A
CURRENCY_CANONICAL_FORMAT:                 N/A
CURRENCY_INPUTMODE:                        N/A

PERCENTAGE_FIELDS:                         none
PERCENTAGE_INPUT_SEMANTICS:                N/A

DATE_FIELDS:                               ScheduleModal date, Calendar dates
GENERIC_DATE_TEXT_INPUTS_BEFORE:           none
DATE_CANONICAL_FORMAT:                     ISO
DATE_TIMEZONE_SHIFT_RISK:                  none introduced

TIME_FIELDS:                               ScheduleModal time
TIME_DISPLAY_FORMAT:                       HH:mm
TIME_CANONICAL_FORMAT:                     HH:mm → startsAt ISO (company tz)
TIMEZONE_AUTHORITY:                        Company.timezone

SCHEDULE_DATE_SEMANTICS:                   type=date
SCHEDULE_TIME_SEMANTICS:                   type=time
SCHEDULE_CANONICAL_DATETIME:               company-timezone ISO
SCHEDULE_BROWSER_TIMEZONE_LEAK:            NO

COLOR_INPUT_SEMANTICS:                     type=color + hex text
IDENTIFIER_FIELDS:                         none
SECRET_FIELDS:                             none
IDENTIFIER_FORMATTING_REQUIRED:            NO

NEW_SHARED_INPUT_COMPONENTS:               PhoneInput
REUSED_EXISTING_INPUT_COMPONENTS:          .input, ModalOrSheet, type=color/date/time/email, Select, ChannelPicker

PHONE_FORMATTER_LOCATION:                  PhoneInput.tsx
PHONE_NORMALIZER_LOCATION:                 PhoneInput.tsx
PHONE_SERIALIZER_LOCATION:                 PhoneInput.tsx

EXISTING_PHONE_HYDRATION:                  YES
UNCHANGED_SUBMIT_CANONICAL_VALUE:          YES
SEMANTIC_INPUT_CANCEL_RESET:               YES

MOBILE_KEYBOARD_PHONE:                     tel
MOBILE_KEYBOARD_EMAIL:                     email
MOBILE_KEYBOARD_NUMERIC:                   N/A
MOBILE_KEYBOARD_DECIMAL:                   N/A
MOBILE_KEYBOARD_URL:                       url

SEMANTIC_INPUT_ACCESSIBILITY:              YES
SERVER_VALIDATION_PRESERVED:               YES
SEMANTIC_INPUT_SERVER_STATE_COMPATIBILITY: YES (React Query remains server authority; PhoneInput
  formats display only, canonical raw digits in state)

F14_4_1_DRAG_RUNTIME_FIX_PRESERVED:        PASS
F14_4_SCHEDULING_INPUT_REGRESSION:         PASS

MIGRATION_CREATED:                         NO
BACKEND_FILES_CHANGED:                     0
LOOPLY_BACKEND_RELOADED:                   NO
FRONTEND_ARTIFACT_CURRENT:                 YES

F14_REGRESSION:                            PASS
F14_1_REGRESSION:                          PASS
F14_1_1_REGRESSION:                        PASS
F14_2_REGRESSION:                          PASS
F14_3_REGRESSION:                          PASS
F14_4_REGRESSION:                          PASS
F14_4_1_REGRESSION:                        PASS

FRONTEND_TESTS:                            258
FRONTEND_TYPECHECK:                        PASS
FRONTEND_BUILD:                            PASS

ORPHAN_VITEST:                             none
ORPHAN_TSC:                                none
DUPLICATE_OPENCODE:                        none (single session)

KORE_TOUCHED:                              NO
```

F14.5 SEMANTIC INPUTS + ADAPTIVE FORMATTING — LIVE VERIFIED