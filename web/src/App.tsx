import { type ReactNode, useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, Loading } from "./components/Feedback";
import { AuditPage } from "./features/audit/AuditPage";
import { LoginPage, SetupPage } from "./features/auth/AuthPages";
import { ClusterCreate } from "./features/clusters/ClusterCreate";
import { ConfigurationPage } from "./features/configuration/ConfigurationPage";
import { ControlPlanePage } from "./features/controlplane/ControlPlanePage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { NodesPage } from "./features/nodes/NodesPage";
import {
  ManagedSettingsPage,
  type SettingsArea,
} from "./features/settings/ManagedSettingsPage";
import { ApiError, api } from "./lib/api";
import type { Cluster, User } from "./lib/types";

type BootState =
  | { kind: "loading" }
  | {
      kind: "setup";
      publicBaseUrl: string;
      controllerTime: string;
      secureCookies: boolean;
    }
  | { kind: "login" }
  | { kind: "authenticated"; user: User }
  | { kind: "error"; error: unknown };

export function App() {
  const [state, setState] = useState<BootState>({ kind: "loading" });

  const boot = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const setup = await api.setupStatus();
      if (setup.setupRequired) {
        setState({
          kind: "setup",
          publicBaseUrl: setup.publicBaseUrl,
          controllerTime: setup.controllerTime,
          secureCookies: setup.secureCookies,
        });
        return;
      }
      try {
        const auth = await api.me();
        setState({ kind: "authenticated", user: auth.user });
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401)
          setState({ kind: "login" });
        else throw caught;
      }
    } catch (caught) {
      setState({ kind: "error", error: caught });
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  switch (state.kind) {
    case "loading":
      return (
        <main className="centred-state">
          <Loading label="Starting AGH HA Controller…" />
        </main>
      );
    case "setup":
      return (
        <SetupPage
          publicBaseUrl={state.publicBaseUrl}
          controllerTime={state.controllerTime}
          secureCookies={state.secureCookies}
          onAuthenticated={(user) => setState({ kind: "authenticated", user })}
        />
      );
    case "login":
      return (
        <LoginPage
          onAuthenticated={(user) => setState({ kind: "authenticated", user })}
        />
      );
    case "authenticated":
      return (
        <Application
          user={state.user}
          onLogout={() => setState({ kind: "login" })}
        />
      );
    case "error":
      return (
        <main className="centred-state">
          <ErrorState error={state.error} retry={() => void boot()} />
        </main>
      );
  }
}

function Application({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [clusters, setClusters] = useState<Cluster[]>();
  const [selectedID, setSelectedID] = useState("");
  const [error, setError] = useState<unknown>();

  const loadClusters = useCallback(
    async (preferredID?: string) => {
      try {
        const result = await api.clusters();
        setClusters(result.items);
        setSelectedID(
          (current) => preferredID ?? (current || result.items[0]?.id || ""),
        );
        setError(undefined);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) onLogout();
        else setError(caught);
      }
    },
    [onLogout],
  );

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  async function logout() {
    try {
      await api.logout();
    } finally {
      onLogout();
    }
  }

  const selected =
    clusters?.find((cluster) => cluster.id === selectedID) ?? clusters?.[0];
  const path = window.location.pathname;
  let content: ReactNode;
  if (clusters === undefined && error === undefined)
    content = <Loading label="Loading clusters…" />;
  else if (clusters === undefined && error !== undefined)
    content = <ErrorState error={error} retry={() => void loadClusters()} />;
  else if (selected === undefined)
    content = (
      <EmptyState title="Create your first cluster">
        <p>
          A cluster groups the AdGuard Home nodes that provide one resilient DNS
          service.
        </p>
        <ClusterCreate onCreated={(cluster) => void loadClusters(cluster.id)} />
      </EmptyState>
    );
  else if (path === "/ha/nodes") content = <NodesPage cluster={selected} />;
  else if (path === "/ha/configuration")
    content = <ConfigurationPage cluster={selected} />;
  else if (path === "/ha/deployments")
    content = <ControlPlanePage cluster={selected} />;
  else if (path === "/system/audit") content = <AuditPage />;
  else if (path.startsWith("/settings/")) {
    const areaByPath: Record<string, SettingsArea> = {
      "/settings/dns": "dns",
      "/settings/filters": "filters",
      "/settings/clients": "clients",
      "/settings/rewrites": "rewrites",
      "/settings/services": "services",
      "/settings/privacy": "privacy",
      "/settings/infrastructure": "infrastructure",
    };
    content = (
      <ManagedSettingsPage
        cluster={selected}
        area={areaByPath[path] ?? "dns"}
      />
    );
  } else content = <DashboardPage cluster={selected} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>
            <strong>AGH HA</strong>
            <small>Controller</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Overview</p>
          <NavLink href="/" current={path === "/"}>
            Dashboard
          </NavLink>
          <p className="nav-label">AdGuard Home</p>
          <NavLink href="/settings/dns" current={path === "/settings/dns"}>
            DNS settings
          </NavLink>
          <NavLink
            href="/settings/filters"
            current={path === "/settings/filters"}
          >
            Filters
          </NavLink>
          <NavLink
            href="/settings/clients"
            current={path === "/settings/clients"}
          >
            Clients
          </NavLink>
          <NavLink
            href="/settings/rewrites"
            current={path === "/settings/rewrites"}
          >
            DNS rewrites
          </NavLink>
          <NavLink
            href="/settings/services"
            current={path === "/settings/services"}
          >
            Services &amp; safety
          </NavLink>
          <NavLink
            href="/settings/privacy"
            current={path === "/settings/privacy"}
          >
            Logs &amp; statistics
          </NavLink>
          <NavLink
            href="/settings/infrastructure"
            current={path === "/settings/infrastructure"}
          >
            TLS &amp; DHCP
          </NavLink>
          <p className="nav-label">HA management</p>
          <NavLink href="/ha/nodes" current={path === "/ha/nodes"}>
            Nodes
          </NavLink>
          <NavLink
            href="/ha/configuration"
            current={path === "/ha/configuration"}
          >
            Configuration
          </NavLink>
          <NavLink href="/ha/deployments" current={path === "/ha/deployments"}>
            Deployments &amp; drift
          </NavLink>
          <p className="nav-label">System</p>
          <NavLink href="/system/audit" current={path === "/system/audit"}>
            Audit log
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <strong>DNS independent</strong>
          <span>Nodes keep serving when this controller is offline.</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <label className="cluster-select">
            <span>Cluster</span>
            <select
              value={selected?.id ?? ""}
              onChange={(event) => setSelectedID(event.target.value)}
              disabled={(clusters?.length ?? 0) === 0}
            >
              {(clusters ?? []).map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))}
            </select>
          </label>
          <div className="user-menu">
            <span>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
            </span>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="content">{content}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: string;
}) {
  return (
    <a
      href={href}
      className={current ? "nav-link nav-link--current" : "nav-link"}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </a>
  );
}
