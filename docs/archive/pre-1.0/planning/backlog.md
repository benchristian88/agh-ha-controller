# Product Backlog

## Core control plane

- Node groups.
- Cluster labels.
- Maintenance windows.
- Dry-run deployment.
- Deployment approval policy.
- Partial deployment recovery.
- Configuration templates.
- Export and import.
- Compatibility matrix.
- Schema-version fixture maintenance and upgrade tooling.
- Node replacement workflow.

## User experience

- First-run wizard.
- Guided node onboarding.
- Side-by-side configuration diff.
- Revision timeline.
- Deployment progress.
- Drift explanation.
- Mobile-responsive health view.
- Keyboard-accessible administration.
- Contextual documentation links.

## Observability

- Email alerts.
- Node response-time trends.
- Broader HTTP/database/collector Prometheus metrics beyond the bounded worker
  metrics delivered in 0.7.
- Conditional forwarder investigation only after an ADR-0029 trigger.

## Security

- OIDC.
- RBAC.
- API tokens.
- Credential rotation.
- TLS certificate/key secret references and rotation.
- Certificate pinning.
- Audit export.
- Session management page.
- Recovery codes.

## Operations

- Automated PostgreSQL backup.
- Restore verification.
- Automated node package/container upgrades and rollback after an authenticated
  execution-boundary ADR; Release 0.8 provides guided coordination only.
- Diagnostic bundle with redaction.
- Proxmox installation script.
- Docker health checks.
- Air-gapped installation guide.
