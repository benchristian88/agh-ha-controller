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
| Frontend static/build | Passed: Biome, TypeScript, 44 Vitest files/230 tests, asset validation, and production Vite build. The pre-existing non-fatal JavaScript chunk-size advisory remains. |
| Go/repository regression | Passed: full Go suite, uncached race suite, vet, Go formatting check, and `git diff --check`. PostgreSQL integration tests compiled and used their normal environment-gated path. No Go behavior or database migration changed. |
| Packaging/dependencies | Passed: controller, migrator, backup CLI, and production frontend build with aligned `0.9.1-dev` defaults; installer/release script syntax; zero production npm vulnerabilities. Docker/Compose was not rerun locally. |
| Local Chromium visual smoke | Passed: 1440px explicit Light and System/Dark shell, 500px compact Light header, and 500px System/Dark login. Screenshots are under `frontend/screenshots/release-0.9.1/`; no console-visible application failure or missing asset was observed. |

## Theme refinement hotfix evidence — 11 August 2026

The visual-system hotfix remains frontend presentation only. It changes no
domain entity, database record, API contract, authentication, desired state,
revision, deployment, drift, telemetry, backup, update, or DNS-path behavior.

| Gate | Result |
|---|---|
| Entry review | Root `AGENTS.md`, frontend design/theme/component documents, semantic tokens, shell/layout, shared cards, status, forms, tables, feedback, overlays, charts, and the required page set were reviewed before edits. No nested `AGENTS.md` exists. |
| Surface implementation | Passed: Light uses page/card/inset `#F3F5F7` / `#FFFFFF` / `#E9EEF3`; Dark uses `#151A20` / `#1D242D` / `#252E38`. Popup, border, strong-border, input, text, and semantic status mappings remain centralized in `design-tokens.css`. |
| HA summary correction | Passed: Dashboard, Statistics, Operational Status, HA Operations, and Node Lifecycle now use one shared `MetricCard`. HA Operations renders four `.metric-card` children with explicit label/value elements and no obsolete `.metric` element. |
| Status hierarchy | Passed: success, information, warning, danger, and neutral badges use compact shared foreground/soft/background/border treatments with a dot and textual label. Atlas Blue remains the primary interaction, selection, link, and focus role. |
| Contrast calculation | Passed: normal semantic text/background pairs range from 4.59:1 to 14.85:1. White on Atlas Blue is 5.17:1. Shared input boundaries are at least 3.10:1 against their input surface and shared focus rings exceed 3:1 against adjacent primary surfaces. Disabled controls retain native/visual disabled treatment and are not relied on for actionable state. |
| Frontend/static | Passed: 44 Vitest files / 230 tests, TypeScript, Biome, asset validation, production Vite build, undefined-token audit, raw-colour audit, and `git diff --check`. The pre-existing Vite chunk advisory remains non-fatal. |
| Repository regression | Passed: full Go suite, uncached race suite, and `go vet ./...`. PostgreSQL integration packages compiled through their normal environment-gated path; no backend or migration changed. |
| Chromium route matrix | Passed with a temporary loopback-only API fixture and the real Vite application. Dashboard, Nodes, HA Operations, Operational Status, Statistics, Query Log, General Settings, Users, System Settings, and Backup & Restore rendered at 1280×900 in explicit Light and Dark. Every capture resolved the requested theme, reported no global load error, no runtime/log error, and `scrollWidth === clientWidth`. No fixture or test route remains in the repository. |
| Responsive Chromium | Passed in Light and Dark: HA Operations at 1440×1000, 1280×900, 768×1024, 390×844, and 844×390; representative Dashboard, Query Log, and General Settings at 390×844. Summary cards wrap 4 → 2 → 1 columns, status badges remain compact, and wide tables remain inside local scrollers without page overflow. |
| Browser scope | Current Chromium is the declared tested browser and passed. Firefox is not installed on the validation host; Safari is installed but has no supported headless matrix path here. Firefox and Safari/iOS remain expected/external gates and are not inferred from Chromium. |

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
