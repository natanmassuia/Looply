# Looply V1 — Assistant Natural Language Adapter

## Purpose

A2.1 converts plain text into a validated structured command. It does not execute domain operations itself. Execution remains owned by the A2 command router.

## Architecture

`POST /api/assistant/messages -> auth/workspace context -> language model -> strict output validation -> A2 executeAssistantCommand -> canonical service`.

The language adapter is `assistantLanguageAdapter.ts`. The provider contract and OpenAI-compatible implementation are in `assistantLanguageModel.ts`.

## Trust Boundary

User text and model output are untrusted. The adapter never accepts authority fields from either. `companyId`, `userId`, capabilities, and company timezone come from authenticated/server context. The adapter has no Prisma resource access.

## LLM Provider Interface

`AssistantLanguageModel` has one method: `generateStructuredOutput(request)`. The request contains the small system prompt, user message, current timestamp, and company timezone. The concrete `OpenAICompatibleLanguageModel` uses native `fetch`, optional environment configuration, JSON response format, timeout, and no credential logging.

## Structured Output Contract

The model must return exactly one of:

```json
{"kind":"command","operation":"calendar.read","payload":{"mode":"list"}}
{"kind":"clarification","message":"Qual reunião?"}
{"kind":"unsupported","message":"Esse recurso não está disponível."}
```

The adapter parses the envelope with strict Zod, then reuses A2 `validateAssistantCommand` for operation-specific payload validation. Invalid output never reaches execution.

## Exact Eight Operations

Only A2's exact eight operations are accepted: four Calendar operations and four Ticket operations. Ninth operations and arbitrary tools are rejected as invalid model output.

## Date and Time Context

The route reads `Company.timezone` and passes it with an ISO current timestamp to the model. Relative phrases must be resolved by the provider in that company timezone. The adapter accepts only normalized ISO timestamps in command payloads; it does not use server-local time or persist timezone strings.

## Entity Resolution

The adapter does not search or resolve Client names, Appointment names, or Job names. Update/delete/detail commands should contain explicit identifiers. Missing deterministic identifiers produce a clarification result from the model rather than selecting the first record.

## Clarification

Ambiguous requests return `ASSISTANT_CLARIFICATION_REQUIRED` and HTTP 409 from the messages route. No A2 command is executed.

## Unsupported Requests

Requests for files, approvals, clients, workflow stages, dashboard, team, or other unsupported tools return `ASSISTANT_UNSUPPORTED_OPERATION` and HTTP 400. No domain service is called.

## Confirmation Delegation

The natural-language route passes the request's `confirmed` flag to A2. It does not implement a second confirmation policy. A2 blocks unconfirmed update/delete operations with `ASSISTANT_CONFIRMATION_REQUIRED`; the model cannot bypass that rule.

## Error Handling

Provider failures, empty/malformed responses, invalid operation envelopes, and invalid payloads return sanitized structured errors. API keys, provider headers, raw provider responses, and stack traces are not returned.

## Security

Strict operation allowlist and payload schemas prevent arbitrary dispatch and authority-field injection. The route is behind existing authentication, password-change, active-workspace, CSRF, and request logging middleware. Domain execution remains tenant/capability protected by A2 and canonical services.

## Testing

Tests use deterministic fake language models. They cover all eight operations, timezone context, ISO output, malformed/ninth/protected fields, clarification, unsupported requests, provider failure, confirmation delegation, HTTP behavior, and no-execution safety. No live provider call runs in the normal suite.

## Deferred WhatsApp

WhatsApp intake, webhook handling, outbound messaging, and delivery state are deferred to A3.

## Deferred Audio

Audio upload, transcription, speech processing, and voice responses are deferred to A3.
