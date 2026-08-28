# Runbook Operacional A2: Rotação e Purga de Credencial Administrativa

> **AVISO**: Este documento é um runbook operacional de preparação. **NÃO** deve ser executado automaticamente durante rotinas de desenvolvimento ou sem prévio alinhamento e autorização dos mantenedores.

---

## 1. Contexto do Incidente
A credencial de seed do administrador (`SEED_ADMIN_PASSWORD`) foi hardcoded no script de captura de mockups `scripts/capture-looply.ts` e commitada nos commits `47b42b8` e `0816379` do repositório `verbumlab`.

O código em `verbumlab/scripts/capture-looply.ts` já foi corrigido para consumir a variável de ambiente `process.env.LOOPLY_ADMIN_PASSWORD`.

---

## 2. Procedimento de Rotação de Credenciais (Ambiente de Produção)

### Etapa 2.1: Geração de Nova Senha Segura
Gerar uma nova senha aleatória com alta entropia (mínimo 32 caracteres):
```bash
openssl rand -base64 24
```

### Etapa 2.2: Atualização do `.env` no Servidor de Produção
No servidor que hospeda a instância do Looply (fora do repositório git):
1. Editar o arquivo `.env` de produção:
   ```bash
   # Exemplo: /srv/verbum/apps/looply/.env ou diretório operacional correspondente
   SEED_ADMIN_PASSWORD="<NOVA_SENHA_GERADA>"
   ```
2. Garantir permissões restritas (`chmod 600 .env`).

### Etapa 2.3: Atualização do Hash do Usuário Admin no Banco
Acesse a aplicação autenticado como admin ou utilize o fluxo de recuperação/troca de senha (`PATCH /api/auth/change-password` ou CLI script operacional):
1. A troca de senha revoga todas as sessões ativas existentes do usuário no banco (`deleteMany` em `sessions`).
2. Validar que a tentativa de login com a **senha antiga** retorna `401 Unauthorized`.
3. Validar que o login com a **nova senha** retorna `200 OK` e emite nova sessão.

---

## 3. Procedimento de Purga do Histórico Git (`verbumlab`)

> ⚠️ **ATENÇÃO**: A reescrita de histórico altera os hashes de commit e exige coordenação com toda a equipe para evitar pull acidental do histórico antigo.

### Etapa 3.1: Instalação da Ferramenta Canônica
Certifique-se de que o `git-filter-repo` está instalado:
```bash
pip install git-filter-repo
```

### Etapa 3.2: Criação do Arquivo de Substituição de Texto
Crie um arquivo temporário `replace-passwords.txt` contendo o mapeamento da credencial exposta para uma string censurada:
```text
REDACTED_LOOPLY_ADMIN_PASSWORD==>REDACTED_LOOPLY_ADMIN_PASSWORD
```

### Etapa 3.3: Execução da Purga no Repositório `verbumlab`
No repositório `verbumlab`:
```bash
cd /path/to/verbumlab

# Executa a substituição em todo o histórico
git-filter-repo --replace-text replace-passwords.txt --force

# Remove o arquivo temporário de mapeamento
rm replace-passwords.txt
```

### Etapa 3.4: Verificação da Purga
Verificar se restou qualquer menção à credencial antiga no histórico de todos os branches e tags:
```bash
git log --all -S'REDACTED_LOOPLY_ADMIN_PASSWORD' --oneline
```
*O comando acima DEVE retornar saída vazia (0 ocorrências).*

### Etapa 3.5: Force Push Coordenado
Após confirmação de que o histórico está limpo:
```bash
git push origin --force --all
git push origin --force --tags
```
Instruir todos os desenvolvedores com clones locais a resetarem seus branches locais a partir do novo `origin/main`:
```bash
git fetch origin
git reset --hard origin/main
```

---

## 4. Auditoria Forense e Revisão de Logs de Acesso

1. Inspecionar os logs de acesso do Nginx / PM2 / aplicação entre a data do commit `47b42b8` e a data de rotação.
2. Filtrar requisições para `/api/auth/login` com o email `admin@looply.dev` (ou login do administrador):
   ```bash
   grep "/api/auth/login" /var/log/nginx/access.log | grep -i "admin"
   ```
3. Cruzar os IPs de origem com os endereços IPs conhecidos dos operadores legítimos.
4. Caso haja IPs desconhecidos com resposta `200`, verificar ações registradas no log operacional e histórico de auditoria (`prisma.jobActivity`, `prisma.content`, etc.).
