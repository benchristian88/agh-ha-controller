# Regression Safety Rules

## Preserve architecture

Do not alter without separate approval:

- schema-v2 desired-state document;
- optimistic draft concurrency;
- immutable revisions;
- all-node capability preflight;
- durable sequential deployment;
- read-back verification;
- active revision only after total verified success;
- drift policies;
- TLS redaction;
- single-active DHCP validation;
- disable-before-enable DHCP handoff;
- controller outside DNS path.

## Migration method

For every phase:

1. Run existing tests.
2. Record affected routes/components.
3. Change the smallest coherent layer.
4. Keep API contracts stable unless the feature requires a new controller operation.
5. Add tests before deleting old implementation.
6. Compare screenshots.
7. Commit the phase separately.
8. Re-run the complete frontend and backend test suite.

## Avoid

- big-bang frontend rewrite;
- raw AdGuard node API calls from the browser;
- direct node mutation from settings pages;
- changing Save Draft into Deploy;
- putting TLS secrets into desired state;
- making Statistics or Query Log appear implemented before their data pipelines exist;
- deleting legacy routes without redirects;
- silently swallowing unknown routes;
- replacing stable backend logic for visual convenience.

## Operational actions

New commands must include:

- controller endpoint;
- authentication;
- CSRF protection;
- explicit target scope;
- confirmation if destructive;
- audit event;
- safe error mapping;
- per-node result;
- tests.
