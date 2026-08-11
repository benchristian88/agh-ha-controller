# Release 0.9.1 Validation

## Scope and inherited gate

Release 0.9.1 changes frontend theme, visual branding, header/menu interaction,
and browser install metadata only. It does not change domain entities,
PostgreSQL, API contracts, authentication, desired state, immutable revisions,
deployments, drift, telemetry, backup/restore, updates, or DNS independence.

Release 0.9 is still **implemented; external gates pending** in
`release-0.9-validation.md`. Release 0.9.1 cannot be called fully complete and
validated until those inherited gates and the browser/device checks below are
recorded.

## Local evidence — 11 August 2026

| Gate | Result |
|---|---|
| Theme unit/DOM | Passed: System default, explicit Light/Dark, persistence, invalid-value fallback, OS change in System, explicit-theme stability, resolved artwork, and document attributes. |
| Menu interaction DOM | Passed: hover open, peer switch, trigger/popover travel delay, pointer leave close, click activation, outside pointer close, Arrow focus, Escape close/focus return, controlled mobile disclosure, and drawer Escape. |
| Accessibility | Passed: existing Axe WCAG A/AA structural shell and expanded-mobile checks with theme control and new menu semantics. Colour contrast remains a real-browser check because jsdom has no layout/colour engine. |
| Asset/manifest | Passed: `npm run test:assets` parses the manifest; preserves AGH HA naming; checks exact public set, V3 source equality, PNG dimensions, HTML references, and absence of the old icon reference. |
| Frontend static/build | Passed: Biome, TypeScript, 44 Vitest files/229 tests, asset validation, and production Vite build. The pre-existing non-fatal JavaScript chunk-size advisory remains. |
| Go/repository regression | Passed: full Go suite, uncached race suite, vet, Go formatting check, and `git diff --check`. PostgreSQL integration tests compiled and used their normal environment-gated path. No Go behavior or database migration changed. |
| Packaging/dependencies | Passed: controller, migrator, backup CLI, and production frontend build with aligned `0.9.1-dev` defaults; installer/release script syntax; zero production npm vulnerabilities. Docker/Compose was not rerun locally. |
| Local Chromium visual smoke | Passed: 1440px explicit Light and System/Dark shell, 500px compact Light header, and 500px System/Dark login. Screenshots are under `frontend/screenshots/release-0.9.1/`; no console-visible application failure or missing asset was observed. |

## Manual browser and device matrix

Record evidence for:

- fresh first load in System on OS light and dark;
- OS theme change while System is selected;
- reload with explicit Light and explicit Dark;
- theme-colour browser chrome where supported;
- every visible route in both themes, including charts, tables, dialogs,
  status, progress, code/rule editors, warnings, and focus rings;
- header and login at desktop, tablet, phone portrait, and phone landscape;
- mouse hover travel, delayed leave, peer switching, outside click, click
  toggle, arrows/Home/End, Tab, Escape, focus return, touch, and mobile drawer;
- favicon ICO/SVG/PNG selection and cache refresh;
- iOS Apple touch icon and saved standalone launch;
- Android 192/512 installed icon and standalone launch; and
- no missing asset request, horizontal overflow, or console error.

Target current Chromium desktop/mobile first, then current Firefox and
Safari/iOS as defined by the compatibility matrix. Do not infer Safari/iOS
support from jsdom or Chromium alone.

## Known limitations

- Real-browser contrast, SVG rasterization, browser theme chrome, favicon
  cache behavior, platform icon masking, and installed-PWA presentation require
  external evidence.
- The V3 source pack includes a brand disclaimer; no trademark or name
  availability clearance is asserted.
- The manifest intentionally has no service worker or offline data cache.
- Atlas textual and technical rename work remains Release 1.0.
- The local headless Chromium build enforces a 500px minimum layout viewport;
  a true 390px mobile browser remains external evidence despite DOM coverage.
