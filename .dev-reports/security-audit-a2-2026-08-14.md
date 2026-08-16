# Security Audit — A2 Assistant Command Router

## Executive Summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low/Info | 1 |

## Checks

| Check | Result |
|---|---|
| Exact operation allowlist | PASS |
| Arbitrary operation/property dispatch | PASS; explicit switch only |
| Strict payload/mass assignment | PASS |
| Company/user/capability spoofing | PASS; strict rejection and trusted context |
| Calendar/Ticket capability separation | PASS |
| Foreign resource handling | Delegated to canonical tenant-safe services |
| Lifecycle bypass | PASS; ticket delete calls `transitionJobLifecycle` |
| Hard delete | ABSENT |
| Stack/database detail exposure | PASS; structured sanitized errors |
| LLM/provider exposure | ABSENT |

## Low/Informational

The HTTP adapter performs one tenant company-template lookup to build trusted capability context. It does not read or mutate resource rows; resource access remains inside canonical domain services.

## Out Of Scope

Natural-language parsing, LLM providers, WhatsApp, audio, transcription, frontend, and external integrations.
