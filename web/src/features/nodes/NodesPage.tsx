import { type FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { StatusBadge } from "../../components/StatusBadge";
import { api, type NodePayload } from "../../lib/api";
import type { CertificatePolicy, Cluster, Node } from "../../lib/types";

export function NodesPage({ cluster }: { cluster: Cluster }) {
  const [nodes, setNodes] = useState<Node[]>();
  const [error, setError] = useState<unknown>();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Node>();

  const load = useCallback(async () => {
    try {
      setNodes((await api.nodes(cluster.id)).items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [cluster.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">HA management</p>
          <h1>Nodes</h1>
          <p className="muted">
            Health, version, and controller connectivity for {cluster.name}.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            setShowAdd((value) => !value);
            setEditing(undefined);
          }}
        >
          {showAdd ? "Cancel" : "Add node"}
        </button>
      </header>
      {showAdd && (
        <NodeForm
          cluster={cluster}
          onSaved={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
      {editing !== undefined && (
        <NodeForm
          cluster={cluster}
          node={editing}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
      {nodes === undefined && error === undefined && (
        <Loading label="Loading nodes…" />
      )}
      {nodes === undefined && error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {nodes?.length === 0 && !showAdd && (
        <EmptyState title="No managed nodes">
          <p>Add an AdGuard Home node to begin automatic status polling.</p>
        </EmptyState>
      )}
      {nodes !== undefined && nodes.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Status</th>
                <th>Version</th>
                <th>Convergence</th>
                <th>Last seen</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <strong>{node.name}</strong>
                    <span className="table-subtitle">{node.baseUrl}</span>
                  </td>
                  <td>
                    <StatusBadge status={node.healthStatus} />
                  </td>
                  <td>
                    {node.version ?? "—"}
                    <span className="table-subtitle">
                      {node.compatibilityStatus}
                    </span>
                  </td>
                  <td>
                    {node.maintenanceMode
                      ? "Maintenance"
                      : node.convergenceStatus.replaceAll("_", " ")}
                  </td>
                  <td>{formatTime(node.lastSeenAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => void maintenance(node)}
                      >
                        {node.maintenanceMode
                          ? "Leave maintenance"
                          : "Maintenance"}
                      </button>
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => {
                          setEditing(node);
                          setShowAdd(false);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button button--quiet"
                        onClick={() => void test(node)}
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => void remove(node)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  async function test(node: Node) {
    try {
      await api.testNode(node.id);
      await load();
    } catch (caught) {
      setError(caught);
      await load();
    }
  }

  async function remove(node: Node) {
    const confirmName = window.prompt(
      `Type ${node.name} to remove this node. Its stored credentials will be destroyed.`,
    );
    if (confirmName === null) return;
    try {
      await api.deleteNode(node, confirmName);
      await load();
    } catch (caught) {
      setError(caught);
    }
  }

  async function maintenance(node: Node) {
    if (
      !node.maintenanceMode &&
      !window.confirm(
        `Put ${node.name} into maintenance? Automatic deployment and reconciliation will skip it until maintenance is removed.`,
      )
    )
      return;
    try {
      await api.setNodeMaintenance(node, !node.maintenanceMode);
      await load();
    } catch (caught) {
      setError(caught);
    }
  }
}

function NodeForm({
  cluster,
  node,
  onSaved,
}: {
  cluster: Cluster;
  node?: Node;
  onSaved: () => void;
}) {
  const [name, setName] = useState(node?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(node?.baseUrl ?? "https://");
  const [policy, setPolicy] = useState<CertificatePolicy>(
    node?.certificatePolicy ?? "system",
  );
  const [customCaPem, setCustomCaPem] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(node?.enabled ?? true);
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const payload: NodePayload = {
      name,
      baseUrl,
      certificatePolicy: policy,
      enabled,
    };
    if (customCaPem.trim() !== "") payload.customCaPem = customCaPem;
    if (username !== "" || password !== "")
      payload.credentials = { username, password };
    if (node !== undefined) payload.recordVersion = node.recordVersion;
    try {
      if (node === undefined) {
        if (payload.credentials === undefined)
          throw new Error("Username and password are required for a new node.");
        await api.createNode(cluster.id, payload);
      } else {
        await api.updateNode(node.id, payload);
      }
      setPassword("");
      onSaved();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="card form-stack node-form"
      onSubmit={(event) => void submit(event)}
    >
      <div>
        <p className="eyebrow">
          {node === undefined ? "Onboarding" : "Node settings"}
        </p>
        <h2>
          {node === undefined ? "Add AdGuard Home node" : `Edit ${node.name}`}
        </h2>
      </div>
      <div className="form-grid">
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <label>
          Administration URL
          <input
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            required
          />
        </label>
        <label>
          TLS trust policy
          <select
            value={policy}
            onChange={(event) =>
              setPolicy(event.target.value as CertificatePolicy)
            }
          >
            <option value="system">System trust</option>
            <option value="custom_ca">Custom private CA</option>
            <option value="insecure_http">Explicit plaintext HTTP</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable automatic health polling
        </label>
      </div>
      {policy === "custom_ca" && (
        <label>
          Custom CA certificate
          <textarea
            rows={6}
            value={customCaPem}
            onChange={(event) => setCustomCaPem(event.target.value)}
            placeholder={
              node === undefined
                ? "-----BEGIN CERTIFICATE-----"
                : "Leave blank to retain the stored CA"
            }
          />
        </label>
      )}
      {policy === "insecure_http" && (
        <div className="notice notice--warning">
          Plain HTTP exposes node credentials on the management network. TLS
          certificate verification cannot otherwise be disabled.
        </div>
      )}
      <fieldset>
        <legend>
          {node === undefined
            ? "Node credentials"
            : "Rotate credentials (optional)"}
        </legend>
        <div className="form-grid">
          <label>
            Username
            <input
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required={node === undefined}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required={node === undefined}
            />
          </label>
        </div>
      </fieldset>
      <p className="muted">
        The controller tests authentication and status before it stores
        encrypted credentials. It does not change node configuration.
      </p>
      {error !== undefined && <ErrorState error={error} />}
      <button type="submit" className="button" disabled={submitting}>
        {submitting ? "Testing and saving…" : "Test and save"}
      </button>
    </form>
  );
}

function formatTime(value?: string): string {
  if (value === undefined) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleString();
}
