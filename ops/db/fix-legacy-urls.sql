-- ==============================================================================
-- Script de Neutralização de Esquemas Inseguros Legados (Achado A1)
--
-- ATENÇÃO: Execute manualmente apenas se houver registros inseguros identificados.
-- Este script faz a limpeza segura (SET NULL) de campos com esquemas perigosos:
--   - javascript:...
--   - data:...
--   - vbscript:...
--
-- Como executar (com DATABASE_URL configurada no ambiente):
--   psql "$DATABASE_URL" -f ops/db/fix-legacy-urls.sql
-- ==============================================================================

BEGIN;

-- 1. CONFERÊNCIA ANTES DA NEUTRALIZAÇÃO
SELECT 'JobVersion antes' AS tabela, count(*) AS registros_inseguros
FROM "JobVersion"
WHERE "mediaUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Company (logoUrl) antes' AS tabela, count(*) AS registros_inseguros
FROM "Company"
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Company (website) antes' AS tabela, count(*) AS registros_inseguros
FROM "Company"
WHERE "website" ~* '^(javascript|data|vbscript):';

SELECT 'Client (logoUrl) antes' AS tabela, count(*) AS registros_inseguros
FROM "Client"
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

SELECT 'User (avatarUrl) antes' AS tabela, count(*) AS registros_inseguros
FROM "User"
WHERE "avatarUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Conversation (contactAvatarUrl) antes' AS tabela, count(*) AS registros_inseguros
FROM "Conversation"
WHERE "contactAvatarUrl" ~* '^(javascript|data|vbscript):';


-- 2. NEUTRALIZAÇÃO CONTROLADA (SET NULL)
UPDATE "JobVersion"
SET "mediaUrl" = NULL
WHERE "mediaUrl" ~* '^(javascript|data|vbscript):';

UPDATE "Company"
SET "logoUrl" = NULL
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

UPDATE "Company"
SET "website" = NULL
WHERE "website" ~* '^(javascript|data|vbscript):';

UPDATE "Client"
SET "logoUrl" = NULL
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

UPDATE "User"
SET "avatarUrl" = NULL
WHERE "avatarUrl" ~* '^(javascript|data|vbscript):';

UPDATE "Conversation"
SET "contactAvatarUrl" = NULL
WHERE "contactAvatarUrl" ~* '^(javascript|data|vbscript):';


-- 3. CONFERÊNCIA DEPOIS DA NEUTRALIZAÇÃO (TODOS OS TOTAIS DEVEM SER 0)
SELECT 'JobVersion depois' AS tabela, count(*) AS registros_inseguros
FROM "JobVersion"
WHERE "mediaUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Company (logoUrl) depois' AS tabela, count(*) AS registros_inseguros
FROM "Company"
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Company (website) depois' AS tabela, count(*) AS registros_inseguros
FROM "Company"
WHERE "website" ~* '^(javascript|data|vbscript):';

SELECT 'Client (logoUrl) depois' AS tabela, count(*) AS registros_inseguros
FROM "Client"
WHERE "logoUrl" ~* '^(javascript|data|vbscript):';

SELECT 'User (avatarUrl) depois' AS tabela, count(*) AS registros_inseguros
FROM "User"
WHERE "avatarUrl" ~* '^(javascript|data|vbscript):';

SELECT 'Conversation (contactAvatarUrl) depois' AS tabela, count(*) AS registros_inseguros
FROM "Conversation"
WHERE "contactAvatarUrl" ~* '^(javascript|data|vbscript):';

COMMIT;
