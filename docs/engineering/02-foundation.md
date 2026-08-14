# Foundation (B1)

Estado real da foundation técnica após a Bateria 1. Nada aqui antecipa domínios da B2+.

## Application Bootstrap (`backend/src/app.ts`)
- Express + helmet + cors (`CORS_ORIGIN`) + `express.json` (1mb).
- Ordem: `requestId` → `requestLogger` → rotas → `notFoundHandler` → `errorHandler`.
- Rotas de domínio existentes (demo) permanecem inalteradas.

## Config / Env (`backend/src/lib/env.ts`)
- `env` é snapshot no import (dotenv do repo root ou `backend/.env`).
- `validateEnv()` falha cedo no startup do servidor (`server.ts`): exige `DATABASE_URL`, valida `PORT`, e proíbe `DEV_DEMO_USER=true` em production. Lê `process.env` em tempo real (testável).
- Vars futuras (Redis, S3, Resend, Sentry) NÃO são obrigatórias — o código atual não depende delas.

## Erros (`backend/src/lib/errors.ts`)
- Contrato: `{ error: { code, message, requestId?, details? } }`.
- `AppError` = erro conhecido; qualquer outro vira 500 `internal_error`.
- Erros Prisma mapeados (P2025→404, P2002→409, validação→400).
- Stack só aparece em log do servidor (via logger), nunca na resposta.
- `asyncHandler` continua sendo o mecanismo de captura.

## Validation (`backend/src/lib/parse.ts` + `lib/validation.ts`)
- Primitivo único: `parse(schema, data)` com Zod → `AppError` 400 `validation_error`.
- Migração de rotas para o contrato acontece em cada bateria de domínio.

## Request ID (`backend/src/middleware/requestId.ts`)
- UUID por request (`node:crypto.randomUUID`).
- Honra `x-request-id` inbound somente se `[A-Za-z0-9_-]{8,64}`; caso contrário substitui.
- Disponível em `res.locals.requestId`, no header de resposta `x-request-id` e no payload de erro.

## Logging (`backend/src/lib/logger.ts`)
- JSON por linha, sem dependência nova (console). Níveis info/warn/error.
- `redact()` mascara `authorization, cookie, set-cookie, password, token, secret, apikey, api_key` (qualquer profundidade).
- Request logger registra method, path (sem query string), status, duração, requestId. Bodies não são logados.

## Health / Readiness (`backend/src/routes/health.ts`)
- `GET /health` — liveness, não toca DB.
- `GET /health/ready` — readiness real: `SELECT 1` via Prisma; 200 `{"status":"ready"}` ou 503 `{"status":"unavailable"}`. Nenhum secret/stack exposto.

## Graceful Shutdown (`backend/src/server.ts`)
- SIGINT/SIGTERM: para de aceitar conexões → `server.close` → `prisma.$disconnect` → exit 0.
- Timeout de segurança de 10s → exit 1 com log.
- `validateEnv()` roda antes do listen.

## Prisma Lifecycle
- Singleton em `lib/db.ts` (KEEP). Schema intocado nesta bateria; nenhuma migration criada.

## Test Strategy / Gates
- Stack: Vitest + supertest (sem frameworks novos). Comandos oficiais: `npm --prefix backend run typecheck|test|build`, idem frontend.
- Testes da foundation: requestId (gera/honra/rejeita inseguro), contrato de erro com requestId, `/health/ready` (shape), redaction, `validateEnv` (missing DATABASE_URL, PORT inválido, DEV_DEMO_USER em prod).

## Demo Shortcuts Preservados
- `DEV_DEMO_USER` mantido (ainda necessário para o app demo funcionar). Remoção → B2 (auth comercial), com guarda: `validateEnv()` já bloqueia o atalho em production.
