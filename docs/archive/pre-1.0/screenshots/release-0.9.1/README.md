# Release 0.9.1 screenshots

These captures use a temporary loopback-only controller API fixture and the
real Vite application in headless Chromium. No fixture or test route remains in
the production tree.

- `header-explicit-light-desktop.png`: 1440×900 explicit Light shell, full
  lockup, Theme control, administration control, context row, and empty-cluster
  workflow.
- `header-system-dark-desktop.png`: 1440×900 System resolved to Dark with the
  dark lockup variant and semantic surfaces.
- `header-explicit-light-mobile-500.png`: 500×844 compact header with approved
  symbol fallback, visible explicit theme state, drawer trigger, scrollable
  context row, and no page-level horizontal overflow.
- `login-system-dark-mobile-500.png`: 500×844 login with the supplied dark
  lockup constrained to the documented authentication width.

This local Chrome build applies a 500px minimum layout viewport in headless
mode even when a smaller screenshot width is requested. A real 390px browser,
phone portrait/landscape, touch interaction, iOS saved-app, Android install,
and Firefox/Safari rendering remain external gates in
`docs/archive/pre-1.0/validation/release-0.9.1-validation.md`.
