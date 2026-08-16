# Security Audit — Looply B4 (Provisioning + Onboarding + Members) — 2026-08-14

Scope: onboardingService, memberService, routes (auth/change-password, onboarding, members, invitations), provision CLI, migration `20260814200000`.

## Executive summary
- Critical: 0 · High: 0 · Medium: 0 · Low: 3 · Info: 4

## Low
| Finding | Location | Detail |
|---|---|---|
| Invitation accept unauthenticated for new users | routes/invitations.ts /accept | The 256-bit single-use hashed token IS the credential — equivalent to a magic link. Acceptable by design (spec-approved invitation-scoped signup); brute force infeasible (2^256), single-use, expiring. |
| No rate limit on /invitations/accept | routes/invitations.ts | Repeated invalid tokens get generic 400. Recommend limiter in hardening battery (B11). |
| Invitation token shown to inviter in response | routes/invitations.ts | By design until email delivery exists (Resend later). Token hash-only in DB. Inviter is an authenticated OWNER/ADMIN of the tenant. |

## Info
- Temporary password: 96-bit base64url, printed ONCE by CLI, hash-only in DB (scrypt), never logged (redaction covers password/token keys). Verified in tests.
- Forced password change enforced by BACKEND (`requirePasswordChanged` on all `/api` except auth/onboarding) — tested via curl (403 on /api/clients before change).
- Change-password revokes ALL user sessions then issues a fresh one — old temp-password login rejected (tested 401).
- Template tampering after ACTIVE: blocked (409 "operação governada") — tested via curl.
- Last-active-OWNER invariant protected (demote/deactivate → 409) — tested.
- Cross-tenant: updateMember scoped by companyId (404 for foreign records — tested); invitations use `req.auth.companyId` only; no `companyId` accepted from body anywhere.
- Role escalation: MEMBER cannot invite; ADMIN can only invite MEMBER; only OWNER manages roles — tested.
- Replay: accepted invitation cannot be reused (tested via curl + unit).
- Email enumeration on invite: distinct 409 messages ("já é membro" vs "convite pendente") reveal membership state to OWNER/ADMIN of the same tenant only — acceptable (insider, same company).
- Public signup: none. No POST /signup route exists; user creation only via provision CLI (operator) or invitation token (this battery). POST /api/team (preexisting dirty worktree) creates Users without password (passwordHash null → cannot authenticate) and sits behind requireAuth+requireWorkspaceActive — not a public signup path; documented for B5/B6 role cleanup.
- CSRF (re-reviewed per B4): all new mutations are JSON POST/PATCH + cookie SameSite=Lax + CORS single-origin — no new attack surface vs B2's documented medium. Decision: keep as V1 debt; revisit in hardening (B11) or when email delivery lands.

## Checked and clean
- Plaintext passwords/tokens never stored/logged; verify via test on state JSON.
- Workspace activation: only via /onboarding/complete with all prerequisites (tested); requireWorkspaceActive blocks domain routes until onboardedAt+template set.
- Migration additive; demo backfill explicit (onboardedAt set, mustChangePassword=false — evidenced fully-operating demo data).
