import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { PageContainer, PageHeader } from "../../components/Page";
import { api } from "../../lib/api";
import type { Cluster, ConfigurationSnapshot, Node } from "../../lib/types";

export function EncryptionPage({ cluster }: { cluster: Cluster }) {
  const [nodes, setNodes] = useState<Node[]>();
  const [snapshots, setSnapshots] = useState<ConfigurationSnapshot[]>();
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    try {
      const [inventory, nodeResult] = await Promise.all([
        api.configurationInventory(cluster.id),
        api.nodes(cluster.id),
      ]);
      setSnapshots(inventory.snapshots);
      setNodes(nodeResult.items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => void load(), [load]);

  const nodeNames = useMemo(
    () => new Map((nodes ?? []).map((node) => [node.id, node.name])),
    [nodes],
  );

  if (nodes === undefined && error === undefined)
    return <Loading label="Loading TLS inventory…" />;
  if (nodes === undefined)
    return <ErrorState error={error} retry={() => void load()} />;

  const observed = (snapshots ?? []).filter(
    (snapshot) => snapshot.document !== undefined,
  );

  return (
    <PageContainer size="full" className="encryption-page">
      <PageHeader
        eyebrow="Observed node state"
        title="Encryption"
        description="Redacted, node-attributed TLS inventory. Certificate secrets remain outside desired state."
      />
      {error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      <div className="notice notice--warning">
        <strong>TLS is inventory-only.</strong> Certificate and private-key
        material never enters a revision or browser response. Change TLS in the
        native node UI while in maintenance, then refresh and adopt the
        observation.
      </div>
      <section className="section-block" aria-labelledby="tls-inventory-title">
        <div className="section-heading">
          <h2 id="tls-inventory-title">TLS inventory</h2>
          <small>{observed.length} observed nodes</small>
        </div>
        {observed.length === 0 ? (
          <EmptyState title="No TLS observations">
            <p>
              Refresh a node from Configuration Control to collect its redacted
              TLS status.
            </p>
          </EmptyState>
        ) : (
          <div className="node-grid">
            {observed.map((snapshot) => {
              const tls = snapshot.document?.observedOnly.tls;
              return (
                <article className="card" key={snapshot.nodeId}>
                  <h3>{nodeNames.get(snapshot.nodeId) ?? snapshot.nodeId}</h3>
                  {tls ? (
                    <dl className="detail-list">
                      <div>
                        <dt>Encryption</dt>
                        <dd>{tls.enabled ? "Enabled" : "Disabled"}</dd>
                      </div>
                      <div>
                        <dt>Server name</dt>
                        <dd>{tls.serverName || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>HTTPS / DoT / DoQ</dt>
                        <dd>
                          {tls.httpsPort || "—"} / {tls.dnsOverTlsPort || "—"} /{" "}
                          {tls.dnsOverQuicPort || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Certificate</dt>
                        <dd>
                          {tls.validPair ? "Valid pair" : "Needs attention"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted">
                      Refresh this node to collect TLS status.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
