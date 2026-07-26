# Frontend Design System

## Colour roles

Suggested starting tokens:

```css
--bg-app: #111827;
--bg-sidebar: #182232;
--bg-header: #151f2d;
--bg-card: #1d2939;
--bg-subtle: #162131;
--border: #2d3a4d;
--text: #f1f5f9;
--text-muted: #9fb0c4;
--accent: #25a875;
--accent-soft: #66d9a5;
--info: #60a5fa;
--warning: #f6b85f;
--danger: #f07b7b;
```

These are project-owned starting values and may change after visual testing.

## Typography

- System sans-serif stack.
- Base size: 16px.
- Secondary labels: 14px.
- Tables: 14px.
- Page title: 18–20px.
- Metric value: 28–32px.
- Use medium weight rather than heavy bold.

## Spacing

Use a consistent 4px base scale.

Common values:

- 8px compact gap.
- 12px control gap.
- 16px card padding.
- 20px page padding.
- 24px major section gap.

## Components

Initial shared components:

- AppShell
- Sidebar
- TopBar
- ScopeSelector
- HealthBadge
- MetricCard
- NodeStatusCard
- DataTable
- EmptyState
- ErrorState
- LoadingSkeleton
- RevisionBadge
- DriftBadge
- DeploymentProgress
- ConfirmationDialog
- Toast
- StructuredDiff
- SecretField
- CapabilityWarning

## Status vocabulary

Use stable labels:

- Healthy
- Degraded
- Unreachable
- Converged
- Drifted
- Pending
- Applying
- Verifying
- Failed
- Maintenance
- Incompatible

Each status uses icon, text, and colour.
