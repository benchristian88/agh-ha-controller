import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StatusBadge } from "../components/StatusBadge";
import { api } from "../lib/api";
import { clusterHealth } from "../lib/freshness";
import type {
  Cluster,
  ConfigurationRevision,
  Deployment,
  Node,
  User,
} from "../lib/types";
import {
  ADMINISTRATION_NAVIGATION,
  isGroupActive,
  isNavigationGroup,
  type NavigationGroup,
  type NavigationLink,
  PRIMARY_NAVIGATION,
} from "./navigation";
import { ScopeProvider } from "./ScopeContext";

interface ApplicationShellProps {
  user: User;
  clusters: Cluster[];
  selected?: Cluster;
  pathname: string;
  onSelectCluster: (clusterID: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function ApplicationShell({
  user,
  clusters,
  selected,
  pathname,
  onSelectCluster,
  onLogout,
  children,
}: ApplicationShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<Deployment>();
  const [contextAvailable, setContextAvailable] = useState(true);
  const [scopeNodeID, setScopeNodeID] = useState("");

  const loadContext = useCallback(async () => {
    if (selected === undefined) {
      setNodes([]);
      setRevisions([]);
      setActiveDeployment(undefined);
      return;
    }
    try {
      const [nodeResult, revisionResult, deploymentResult] = await Promise.all([
        api.nodes(selected.id),
        api.configurationRevisions(selected.id),
        api.deployments(selected.id),
      ]);
      const active = deploymentResult.items.find((deployment) =>
        ["queued", "validating", "running", "cancelling"].includes(
          deployment.status,
        ),
      );
      const detailed = active ? await api.deployment(active.id) : undefined;
      setNodes(nodeResult.items);
      setRevisions(revisionResult.items);
      setActiveDeployment(detailed);
      setContextAvailable(true);
    } catch {
      setContextAvailable(false);
    }
  }, [selected]);

  useEffect(() => {
    setScopeNodeID("");
    void loadContext();
    const interval = window.setInterval(() => void loadContext(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadContext]);

  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawerOpen]);

  const activeRevision = revisions.find(
    (revision) => revision.active || revision.id === selected?.activeRevisionId,
  );
  const activeTask = activeDeployment?.nodes.find((node) =>
    ["validating", "applying", "verifying"].includes(node.status),
  );
  const nodeNames = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.name])),
    [nodes],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="AGH HA Controller dashboard">
          <span className="brand-mark">A</span>
          <span className="brand-name">
            <strong>AGH HA</strong>
            <small>Controller</small>
          </span>
        </a>
        <nav className="desktop-navigation" aria-label="Primary navigation">
          {PRIMARY_NAVIGATION.map((item) =>
            isNavigationGroup(item) ? (
              <DesktopGroup key={item.label} group={item} pathname={pathname} />
            ) : (
              <ShellLink key={item.href} item={item} pathname={pathname} />
            ),
          )}
        </nav>
        <details className="administration-menu">
          <summary>
            <span className="administration-identity">
              <strong>{user.displayName}</strong>
              <small>Administration</small>
            </span>
            <span aria-hidden="true">▾</span>
          </summary>
          <div className="nav-popover nav-popover--right">
            <p className="menu-identity">{user.email}</p>
            {ADMINISTRATION_NAVIGATION.map((item) => (
              <ShellLink key={item.href} item={item} pathname={pathname} />
            ))}
            <button className="menu-action" type="button" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </details>
        <button
          className="drawer-toggle"
          type="button"
          aria-expanded={drawerOpen}
          aria-controls="mobile-navigation"
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </header>

      {drawerOpen && (
        <>
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="mobile-drawer" id="mobile-navigation">
            <div className="drawer-heading">
              <strong>Navigation</strong>
              <button
                className="drawer-close"
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <nav aria-label="Mobile navigation">
              {PRIMARY_NAVIGATION.map((item) =>
                isNavigationGroup(item) ? (
                  <MobileGroup
                    key={item.label}
                    group={item}
                    pathname={pathname}
                  />
                ) : (
                  <ShellLink key={item.href} item={item} pathname={pathname} />
                ),
              )}
            </nav>
            <div className="drawer-administration">
              <p className="nav-label">Administration</p>
              {ADMINISTRATION_NAVIGATION.map((item) => (
                <ShellLink key={item.href} item={item} pathname={pathname} />
              ))}
              <button className="menu-action" type="button" onClick={onLogout}>
                Sign Out · {user.displayName}
              </button>
            </div>
          </aside>
        </>
      )}

      <section className="context-row" aria-label="Controller context">
        <label className="context-select">
          <span>Cluster</span>
          <select
            value={selected?.id ?? ""}
            onChange={(event) => onSelectCluster(event.target.value)}
            disabled={clusters.length === 0}
          >
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.name}
              </option>
            ))}
          </select>
        </label>
        <label className="context-select">
          <span>Scope</span>
          <select
            value={scopeNodeID}
            onChange={(event) => setScopeNodeID(event.target.value)}
            disabled={nodes.length === 0}
          >
            <option value="">Entire Cluster</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <span className="context-fact">
          <small>Active revision</small>
          <strong>
            {contextAvailable
              ? activeRevision
                ? `#${activeRevision.revisionNumber}`
                : "None"
              : "Unavailable"}
          </strong>
        </span>
        <span className="context-fact">
          <small>Cluster health</small>
          {contextAvailable ? (
            <StatusBadge status={clusterHealth(nodes)} />
          ) : (
            <strong>Unavailable</strong>
          )}
        </span>
        <span className="context-deployment" aria-live="polite">
          <small>Active deployment</small>
          {contextAvailable && activeDeployment ? (
            <a href="/ha/deployments">
              {activeDeployment.id.slice(0, 8)} ·{" "}
              {activeTask
                ? `${activeTask.status} ${nodeNames.get(activeTask.nodeId) ?? "node"}`
                : activeDeployment.status}
            </a>
          ) : (
            <strong>{contextAvailable ? "None" : "Unavailable"}</strong>
          )}
        </span>
      </section>

      <ScopeProvider value={{ nodeId: scopeNodeID, nodes }}>
        <main className="content">{children}</main>
      </ScopeProvider>
    </div>
  );
}

function DesktopGroup({
  group,
  pathname,
}: {
  group: NavigationGroup;
  pathname: string;
}) {
  const active = isGroupActive(group, pathname);
  return (
    <details className="nav-menu">
      <summary
        className={active ? "nav-parent nav-parent--current" : "nav-parent"}
      >
        {group.label} <span aria-hidden="true">▾</span>
      </summary>
      <div className="nav-popover">
        {group.children.map((item) => (
          <ShellLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </details>
  );
}

function MobileGroup({
  group,
  pathname,
}: {
  group: NavigationGroup;
  pathname: string;
}) {
  const active = isGroupActive(group, pathname);
  return (
    <details className="mobile-nav-group" open={active || undefined}>
      <summary
        className={active ? "nav-parent nav-parent--current" : "nav-parent"}
      >
        {group.label}
      </summary>
      <div className="mobile-nav-children">
        {group.children.map((item) => (
          <ShellLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </details>
  );
}

function ShellLink({
  item,
  pathname,
}: {
  item: NavigationLink;
  pathname: string;
}) {
  const current = item.href === pathname;
  return (
    <a
      href={item.href}
      className={current ? "nav-link nav-link--current" : "nav-link"}
      aria-current={current ? "page" : undefined}
    >
      {item.label}
    </a>
  );
}
