# Looply Operations & Infrastructure

This directory contains versioned operational templates, deployment runbooks, security gate definitions, and backup utilities for Looply.

---

## Directory Layout

- **`deploy/`**: [Deployment Runbook](deploy/README.md) detailing the repeatable staging deployment flow, pre-deploy checklists, migration rules, and rollback procedures.
- **`systemd/`**: [Systemd Service Template](systemd/looply-backend.service) (`looply-backend.service`) configured with process hardening, non-root execution, and loopback binding.
- **`nginx/`**: [Nginx Configuration Template](nginx/looply.verbumlab.com.br.conf) (`looply.verbumlab.com.br.conf`) covering reverse proxying, SPA routing, asset caching, security headers, and Certbot TLS hooks.
- **`backup/`**: Automated PostgreSQL database backup, verify, and restore scripts (`backup.sh`, `restore.sh`, `verify.sh`).
- **`security-gates.md`**: Formal specification of application security gates, SAST, secret scanning, and SCA compliance.

---

## Infrastructure Guidelines

1. **Host Decoupling**: Configuration files in `systemd/` and `nginx/` serve as the versioned source of truth. Any change must be committed here before being installed on `/etc/`.
2. **Zero Secrets**: No production passwords, tokens, private keys, or TLS certificates are stored in this repository.
3. **Reproducibility**: Deployments follow standard, scriptable procedures documented in `deploy/README.md`.
