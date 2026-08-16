# Security Audit — A2.1 Natural Language Adapter

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
| Prompt injection to arbitrary operation | PASS; exact eight-operation Zod allowlist |
| companyId/userId/capability spoofing | PASS; absent from request contract and payload schemas |
| lifecycle/status bypass | PASS; A2 validates Ticket payloads and owns lifecycle |
| confirmation bypass | PASS; A2 remains execution authority |
| Prisma/resource access | PASS; adapter only calls model and A2 |
| provider key/raw response leakage | PASS; errors sanitized |
| unauthenticated access | PASS; existing `/api` middleware chain |

## Informational

The HTTP adapter reads the authenticated Company's timezone/template context. It does not read or mutate resource rows; canonical services remain responsible for tenant isolation.

## Out Of Scope

WhatsApp, audio, transcription, frontend, deployment, external integrations, and live provider operations.
