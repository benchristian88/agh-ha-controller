# Release 0.4.1 screenshots

These browser captures use deterministic controller API fixtures and the
production frontend build. They verify the Configuration Control summary and
the responsive navigation/context shell at desktop and mobile widths.

- `configuration-control-desktop.png`: 1440 × 1000.
- `configuration-control-mobile.png`: 500 × 900.

Phase 3 adds focused captures of the shared page treatment and semantic theme
tokens through the low-risk Not Found proving consumer:

- `shared-primitives-not-found-light-desktop.png`: explicit light theme,
  1440 × 1000.
- `shared-primitives-not-found-dark-mobile.png`: dark theme, 390 × 844.

Phase 10 adds the final breakpoint/theme regression set through the explicit
Not Found consumer:

- `phase-10-not-found-{light,dark}-320.png`: 320 × 800.
- `phase-10-not-found-{light,dark}-768.png`: 768 × 900.
- `phase-10-not-found-{light,dark}-1199.png`: 1199 × 900.
- `phase-10-not-found-{light,dark}-1200.png`: 1200 × 900.
- `phase-10-not-found-{light,dark}-1440.png`: 1440 × 1000.
- `phase-10-mobile-drawer-dark-320.png`: exact 320 × 800 mobile drawer,
  shared hierarchy, Filters parent active, and DNS Rewrites child active.

Exact CDP device metrics were used for 320px captures so Chrome's minimum
desktop-window width could not mask horizontal layout defects.
