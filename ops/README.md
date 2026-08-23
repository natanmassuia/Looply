# Looply Operations & Infrastructure

This directory contains versioned operational templates, deployment runbooks, security gate definitions, and backup utilities for Looply.

---

## Directory Layout

- **`deploy/`**: [Deployment Runbook](deploy/README.md) detailing the repeatable staging deployment flow, pre-deploy checklists, migration rules, and rollback procedures.
- **`systemd/`**: Systemd Service Templates configured with process hardening, non-root execution, and loopback binding:
  - `looply-backend.service`: Main Express API application.
  - `looply-redis.service`: Redis 7 transient store daemon (`127.0.0.1:6379`).
  - `looply-minio.service`: MinIO S3 object storage daemon (`127.0.0.1:9000`).
- **`nginx/`**: [Nginx Configuration Template](nginx/looply.verbumlab.com.br.conf) (`looply.verbumlab.com.br.conf`) covering reverse proxying, SPA routing, asset caching, security headers, S3 presigned proxy (`/looply-attachments/`), and Certbot TLS hooks.
- **`backup/`**: Automated PostgreSQL database backup, verify, and restore scripts (`backup.sh`, `restore.sh`, `verify.sh`).
- **`security-gates.md`**: Formal specification of application security gates, SAST, secret scanning, and SCA compliance.

---

## Infrastructure Guidelines

1. **Host Decoupling**: Configuration files in `systemd/` and `nginx/` serve as the versioned source of truth. Any change must be committed here before being installed on `/etc/`.
2. **Zero Secrets**: No production passwords, tokens, private keys, or TLS certificates are stored in this repository.
3. **Reproducibility**: Deployments follow standard, scriptable procedures documented in `deploy/README.md`.
