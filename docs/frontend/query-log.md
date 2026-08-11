# Query Log Interface

`/query-log` is a dense combined event table within the current controller
navigation and design system. Global scope selects the entire cluster or one
node; the Node column remains visible in either mode so attribution cannot be
lost. Search is debounced and server-side. Status, observed query type, exact
client, and scope are preserved while paging and reset the cursor when changed.

Rows show time, node, client, domain, type, normalized status, and processing
time. The keyboard-operable disclosure opens structured timestamp, node,
client, response, upstream, filtering, rule, answer, cache, and DNSSEC detail.
Loading, filtered/initial empty, stale, partial, unsupported, logging-disabled,
collection-disabled, known-gap, retained-data refresh failure, desktop, and
mobile layouts use shared feedback/table primitives.

The newest page refreshes conservatively. While an older page or detail is open,
the table remains stable and reports newer results rather than moving the
operator's focus. Previous navigation uses the browser's cursor stack; Next uses
the opaque API cursor.

Allow and Block links open Custom Filter Rules with a visible proposed AdGuard
rule and require **Add to Draft** followed by **Save Draft**. Rewrite opens the
existing validated Add DNS Rewrite dialog with only the domain prefilled. Client
links perform a safe search rather than claiming an unmanaged runtime identity
is a persistent client. None publishes, deploys, or calls a node directly.
