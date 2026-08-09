# Web Frontend

This directory contains the React and TypeScript administration interface for Release 0.9.

Read:

- `docs/frontend/frontend-design.md`
- `docs/frontend/design-system.md`
- `docs/frontend/ui-navigation.md`

The directory structure is organised by product feature. Use the exact repository-level environment and validation commands in `../README.md`; frontend-only commands are available through the scripts in `package.json`.

The HA Controller feature folders intentionally separate Nodes,
Configuration Control, Deployments, Drift, and Change History. They may share
typed controller reads and presentation primitives, but each canonical route
owns one lifecycle question as documented in
`docs/frontend/ha-controller-responsibility-separation.md`.
