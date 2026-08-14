# Security Audit — Looply B2 (Auth + Multi-tenancy) — 2026-08-14

Scope: backend auth/session/tenant code added in B2 + cookie/CORS config + login endpoint.

## Executive summary
- Critical: 0
- High: 0
- Medium: 1
- Low: 2
- Info: 3

## Medium
| Finding | Location | Detail | Recommendation |
|---|---|---|---|
| CSRF: cookie auth + state-changing POSTs | backend/src/routes/* | SameSite=Lax blocks cross-site POST from browsers in modern browsers; CORS is single-origin; JSON content-type. No explicit CSRF token. | Acceptable for V1; add double-submit token in B3+ if threat model grows. Documented. |

## Low
| Finding | Location | Detail |
|---|---|---|
| Login limiter is in-process, fixed-window | backend/src/lib/loginLimiter.ts | Resets on restart; not shared across instances. Single-node V1 OK. |
| Session rolling/expiry is fixed 7d | backend/src/lib/session.ts | No sliding renewal; no idle timeout. Acceptable V1. |

## Info
- Password hashing uses node:crypto scrypt (64-byte, 16-byte random salt, timingSafeEqual) — adequate; no new dependency.
- Session token: 256-bit random, only sha256 stored in DB → DB leak does not yield usable cookies. Cookie httpOnly, SameSite=Lax, secure in production, path /.
- Login failures are generic (`invalid_credentials` / "Credenciais inválidas") for unknown email / wrong password / inactive user — no enumeration. Timing side-channel between user-exists and not (scrypt runs only when user found) — note: `login()` skips scrypt when user missing → response-time differential. Mitigation candidate: always run scrypt against a dummy hash. Low severity.
- Trust model: tenant derived from session + active membership revalidated per request; body `companyId` never trusted (tested).
- Helmet headers on; CORS single origin; no wildcard.
- No secrets logged; logger redacts token/password keys; session token never returned in responses (only cookie).

## Checked and clean
- Password/hash/session-secret exposure in responses: none (tested).
- Revoked/expired session, inactive user, revoked membership → 401/403 (tested).
- Cross-tenant switch denied both directions (tested).
- BOLA on auth endpoints: N/A (no tenant-scoped resources yet — domain batteries).
- SQL injection: Prisma parameterized everywhere.
- Mass assignment: login/switch schemas are strict Zod allowlists.

## Out of scope
- Resource endpoints (clients/contents/...) tenant scoping — deferred to B4/B5 (known gap).
- Rate limiting beyond login; password reset flow (B3+).
