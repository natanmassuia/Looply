# A2.1 — Natural Language Adapter

## Executive Decision

**A2.1 IMPLEMENTED — PASS**. Plain text now flows through a minimal provider interface, strict structured-output validation, and the existing A2 command executor. No natural-language path accesses Prisma or bypasses confirmation/capability rules.

## Baseline

| Item | Result |
|---|---|
| Branch | `feature/demo-v1-polish` |
| Initial SHA | `0be41bdd0594da77fd8eb4c6c7064abe92e4dea3` |
| A2 ancestry | Present |
| Backend baseline | 190 tests |
| Frontend baseline | 32 tests |

## Provider Architecture

| Component | Result |
|---|---|
| Interface | `AssistantLanguageModel.generateStructuredOutput` |
| Concrete provider | `OpenAICompatibleLanguageModel` |
| Credentials | Optional env variables only; never hardcoded/logged |
| Normal test mode | Fake provider; no live API calls |
| Fallback/agent/plugin framework | None |

## Prompt Contract

The small deterministic prompt defines the exact eight operations, command/clarification/unsupported envelope, authority-field prohibition, explicit-ID preference, ambiguity behavior, unsupported behavior, and company-timezone date normalization. It does not duplicate domain implementation rules.

## Structured Output

Provider output is parsed as JSON, validated against a strict envelope, then passed to A2 `validateAssistantCommand`. Invalid JSON, missing fields, ninth operations, protected fields, lifecycle fields, and malformed payloads stop before execution.

## Exact Operation Enforcement

Accepted operations are exactly `calendar.create`, `calendar.read`, `calendar.update`, `calendar.delete`, `ticket.create`, `ticket.read`, `ticket.update`, and `ticket.delete`. No dynamic tools or arbitrary operation dispatch exists.

## Tenant Authority

The request body contains only bounded `message` and optional `confirmed`. Company/user/capabilities are derived server-side. Company timezone is read from the authenticated company. The adapter does not resolve entity names or choose tenant records.

## Timezone Context

The provider receives `currentTimestamp` as ISO UTC plus `Company.timezone`. Relative phrases are provider-resolved against that context; structured date payloads must be ISO strings before A2 validation.

## Clarification

Model clarification output becomes `ASSISTANT_CLARIFICATION_REQUIRED` with HTTP 409. No command execution occurs.

## Unsupported Operations

Model unsupported output becomes `ASSISTANT_UNSUPPORTED_OPERATION` with HTTP 400. Requests outside Calendar/Tickets do not call A2 or domain services.

## Confirmation Integration

The route forwards `confirmed` to A2. Read/create behavior remains A2 policy. Update/delete without confirmation return A2's `ASSISTANT_CONFIRMATION_REQUIRED`; confirmed commands execute once through A2.

## HTTP Route

`POST /api/assistant/messages` is mounted under the existing `/api` auth/workspace middleware chain. It does not call domain services directly. Provider errors return sanitized 502-style structured errors; validation is 400.

## Tests

| Area | Result |
|---|---|
| Focused A2 regression suite | PASS, 9 tests |
| Natural-language/provider suite | PASS, 16 tests |
| Exact eight parsing | PASS |
| Safety/no execution | PASS |
| Timezone/ISO context | PASS |
| Confirmation delegation | PASS |
| HTTP route/auth boundary | PASS |

## Security Audit

| Finding | Result |
|---|---|
| Critical findings | 0 |
| High findings | 0 |
| Prompt-injection arbitrary operation | BLOCKED by strict envelope/allowlist |
| Authority spoofing | BLOCKED |
| Confirmation bypass | BLOCKED by A2 |
| Prisma/resource access from adapter | ABSENT |
| Provider secret/raw response leakage | BLOCKED |

## Backend Validation

| Command | Result |
|---|---|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS, 206 tests |
| `npm --prefix backend run build` | PASS |
| `npm --prefix backend run prisma:validate` | PASS |

## Frontend Regression

| Command | Result |
|---|---|
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run test` | PASS, 32 tests |
| `npm --prefix frontend run build` | PASS |
| Frontend changes | NONE |

## Database Safety

No schema, migration, reset, deploy, push, execute, or psql mutation command was run.

## Secret Handling

No `.env`, API key, `DATABASE_URL`, password, token, provider header, or raw provider response was printed or committed.

## Changed Files

| File | Risk |
|---|---|
| `backend/src/services/assistantCommandService.ts` | Low; exports A2 command validation |
| `backend/src/services/assistantLanguageAdapter.ts` | Medium; untrusted model output boundary |
| `backend/src/services/assistantLanguageModel.ts` | Medium; provider boundary |
| `backend/src/routes/assistant.ts` | Medium; authenticated messages endpoint |
| `backend/src/lib/env.ts` | Low; optional provider config |
| `backend/tests/assistantLanguageAdapter.test.ts` | Low; fake-provider coverage |
| `.env.example` | Low; placeholder provider variables |
| `docs/engineering/16-assistant-natural-language-adapter.md` | Low; canonical documentation |
| `.dev-reports/looply-a2-1-natural-language-adapter.md` | Low; final report |
| `.dev-reports/security-audit-a2-1-2026-08-14.md` | Low; security audit |
| `.dev-reports/performance-audit-a2-1-2026-08-14.md` | Low; performance audit |
| `.dev-reports/caveman-2026-08-14.md` | Low; simplification review |

## Commit

Pending final validation and explicit staging. No push or deploy.

## Deferred A3

WhatsApp, webhook intake, outbound messaging, audio, transcription, and voice responses.

## Next Step

Use the text adapter as the future structured intake boundary. Keep all execution in A2 and add WhatsApp/audio only in A3.
