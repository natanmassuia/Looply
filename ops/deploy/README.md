# Looply Staging Deployment Runbook

This document defines the canonical, reproducible deployment procedures for Looply on the Verbum AI Box infrastructure.

---

## 1. Architecture Overview

- **Domain:** `https://looply.verbumlab.com.br`
- **Reverse Proxy / TLS:** Nginx (`169.58.210.205:80`, `:443`) with Let's Encrypt certificates managed by Certbot.
- **Frontend Document Root:** `/srv/verbum/apps/looply/frontend` (Static SPA distribution).
- **Backend Application:** Node.js service running on `127.0.0.1:4000` managed by systemd (`looply-backend.service`).
- **Database:** Private PostgreSQL instance on Docker bridge (`172.20.0.10:5432`), managed via Prisma.
- **Development / Repository Workspace:** `/srv/verbum/workspaces/looply`.

---

## 2. Secrets & Environment Contract

The production environment file is strictly decoupled from version control:
- **Location:** `/srv/verbum/workspaces/looply/.env`
- **Permissions:** `0600` owned by `ops:verbum-ai`.
- **Systemd Loading:** Injected via `EnvironmentFile=/srv/verbum/workspaces/looply/.env`.
- **Validation:** Validated on startup via `validateEnv()` in `backend/src/lib/env.ts` without echoing secrets.
- **Contract Specification:** Reference `.env.example` for required variables (`DATABASE_URL`, `HOST`, `PORT`, `CORS_ORIGIN`, `PUBLIC_APP_URL`, `SEED_ADMIN_*`, etc.).

---

## 3. Pre-Deploy Checklist

Before deploying any release to staging:
1. **Git State:** Ensure workspace is clean and on target branch:
   ```bash
   git status
   git fetch origin
   git log -n 5 --oneline
   ```
2. **CI Validation:** Confirm GitHub Actions CI is green on the target commit.
3. **Current Health Check:** Verify existing staging health:
   ```bash
   curl -s -i https://looply.verbumlab.com.br/health
   systemctl is-active looply-backend
   systemctl is-active nginx
   ```

---

## 4. Deployment Flows

### A. Deploy Without Migration (Standard Release)

1. **Update Workspace Code:**
   ```bash
   git pull origin main
   ```
2. **Build Backend:**
   ```bash
   npm --prefix backend ci
   npm --prefix backend run prisma:generate
   npm --prefix backend run typecheck
   npm --prefix backend run build
   ```
3. **Build Frontend:**
   ```bash
   npm --prefix frontend ci
   npm --prefix frontend run typecheck
   npm --prefix frontend run build
   ```
4. **Publish Frontend (Atomic Swap):**
   ```bash
   # Stage in temporary directory
   rm -rf /srv/verbum/apps/looply/frontend_new
   mkdir -p /srv/verbum/apps/looply/frontend_new
   cp -r frontend/dist/* /srv/verbum/apps/looply/frontend_new/
   chmod -R 755 /srv/verbum/apps/looply/frontend_new
   find /srv/verbum/apps/looply/frontend_new -type f -exec chmod 644 {} +

   # Atomic directory swap
   rm -rf /srv/verbum/apps/looply/frontend_old
   mv /srv/verbum/apps/looply/frontend /srv/verbum/apps/looply/frontend_old
   mv /srv/verbum/apps/looply/frontend_new /srv/verbum/apps/looply/frontend
   ```
5. **Restart Backend Service:**
   ```bash
   sudo systemctl restart looply-backend
   ```
6. **Verify Services & Endpoints:**
   ```bash
   systemctl is-active looply-backend
   curl -s -i https://looply.verbumlab.com.br/health
   curl -s -I https://looply.verbumlab.com.br/
   ```

---

### B. Deploy With Migration (Explicit Database Change)

> **IMPORTANT:** Migrations are applied explicitly and forward-only. Never run `prisma migrate dev` on staging or production.

1. **Pre-Migration Safety Backup:**
   ```bash
   /srv/verbum/workspaces/looply/ops/backup/backup.sh
   ```
2. **Review Pending Migrations:**
   ```bash
   npx prisma migrate status --schema backend/prisma/schema.prisma
   ```
3. **Apply Migrations:**
   ```bash
   npx prisma migrate deploy --schema backend/prisma/schema.prisma
   ```
4. **Proceed with Standard Build & Release (Steps in 4.A).**

---

## 5. Post-Deploy Smoke Verification

Execute the following post-deploy smoke checks:
1. **Backend Health:**
   ```bash
   curl -s https://looply.verbumlab.com.br/health
   # Expected: {"status":"ok","service":"looply-backend","db":"configured"}
   ```
2. **Frontend SPA Root:**
   ```bash
   curl -s -I https://looply.verbumlab.com.br/
   # Expected: HTTP/1.1 200 OK
   ```
3. **Security Headers & Dotfile Blocking:**
   ```bash
   curl -s -I https://looply.verbumlab.com.br/.env
   # Expected: HTTP/1.1 404 Not Found
   ```
4. **Port Binding Verification:**
   ```bash
   ss -tulpn | grep 4000
   # Expected: 127.0.0.1:4000 (never 0.0.0.0:4000)
   ```

---

## 6. Rollback Procedures

### Frontend Rollback
- If `frontend_old` is present:
  ```bash
  mv /srv/verbum/apps/looply/frontend /srv/verbum/apps/looply/frontend_failed
  mv /srv/verbum/apps/looply/frontend_old /srv/verbum/apps/looply/frontend
  ```
- Or rebuild from a previous Git tag/commit and republish using Section 4.A.

### Backend Rollback
1. Checkout previous stable commit:
   ```bash
   git checkout <previous-commit-sha>
   ```
2. Rebuild and restart:
   ```bash
   npm --prefix backend run build
   sudo systemctl restart looply-backend
   ```

### Nginx / Systemd Rollback
1. Restore template from `ops/nginx/` or `ops/systemd/`.
2. Reload systemd / test and reload Nginx:
   ```bash
   sudo systemctl daemon-reload
   sudo nginx -t && sudo systemctl reload nginx
   ```

### Database Rollback Policy
- Code rollback does NOT automatically roll back database migrations.
- If a migration is backwards-incompatible, perform a planned database restore using `ops/backup/restore.sh` with an explicit maintenance window.
