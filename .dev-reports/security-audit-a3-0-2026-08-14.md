# Security Audit — A3.0 WhatsApp Actor & Transient State

## Executive Summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low/Info | 1 |

## Checks

| Area | Result |
|---|---|
| Phone impersonation | PASS; requires persisted `(provider, phone)` mapping plus active user/membership |
| Client-as-user confusion | PASS; resolution never queries Client (test asserts delegate untouched) |
| Ambiguous company membership | PASS; `(userId, companyId)` membership re-proven each resolution |
| Cross-tenant identity escalation | PASS; stored companyId must match a real active membership |
| Capability duplication / arbitrary role assignment | PASS; strict provisioning schema; capabilities derive from template only |
| Transient replay | PASS; atomic GETDEL single-use consume (tested) |
| Idempotency races | PASS; atomic SET NX EX claim (tested) |
| Unsafe fail-open | PASS; store failures propagate; no memory fallback exists |
| Redis secret logging | PASS; REDIS_URL never logged; logger redacts sensitive keys |
| Migration safety | PASS; additive-only artifact, not applied |

## Informational

Provisioning trusts OWNER/ADMIN of the authenticated company (same authority model as member management). If product later wants per-phone OTP self-claiming, it must be a separate verified flow; none exists here.

## Out Of Scope

Webhook processing, outbound messaging, Assistant execution, audio/media — all deferred to A3.1/A3.2.
