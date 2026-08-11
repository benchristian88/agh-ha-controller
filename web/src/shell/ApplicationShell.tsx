import {
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AtlasBrand } from "../components/Brand";
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
import { ThemeControl } from "../theme/ThemeControl";
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

type DesktopMenuID =
  | "settings"
  | "filters"
  | "ha-controller"
  | "administration";
const MENU_CLOSE_DELAY_MS = 180;

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
  const [openMobileMenu, setOpenMobileMenu] = useState<
    DesktopMenuID | undefined
  >(() => activeMobileMenu(pathname));
  const [nodes, setNodes] = useState<Node[]>([]);
  const [revisions, setRevisions] = useState<ConfigurationRevision[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<Deployment>();
  const [contextAvailable, setContextAvailable] = useState(true);
  const [scopeNodeID, setScopeNodeID] = useState("");
  const [openMenu, setOpenMenu] = useState<DesktopMenuID>();
  const closeTimer = useRef<number | undefined>(undefined);
  const hoverOpenedMenu = useRef<DesktopMenuID | undefined>(undefined);
  const menuTriggers = useRef(new Map<DesktopMenuID, HTMLButtonElement>());
  const drawerTrigger = useRef<HTMLButtonElement | null>(null);

  const closeDrawer = useCallback((restoreFocus = false) => {
    setDrawerOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => drawerTrigger.current?.focus());
    }
  }, []);

  const cancelMenuClose = useCallback(() => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  }, []);

  const closeDesktopMenu = useCallback(
    (restoreFocus = false) => {
      cancelMenuClose();
      hoverOpenedMenu.current = undefined;
      setOpenMenu((current) => {
        if (restoreFocus && current !== undefined) {
          menuTriggers.current.get(current)?.focus();
        }
        return undefined;
      });
    },
    [cancelMenuClose],
  );

  const openDesktopMenu = useCallback(
    (menu: DesktopMenuID) => {
      cancelMenuClose();
      setOpenMenu(menu);
    },
    [cancelMenuClose],
  );

  const openDesktopMenuFromHover = useCallback(
    (menu: DesktopMenuID) => {
      hoverOpenedMenu.current = menu;
      openDesktopMenu(menu);
    },
    [openDesktopMenu],
  );

  const toggleDesktopMenu = useCallback(
    (menu: DesktopMenuID) => {
      cancelMenuClose();
      setOpenMenu((current) => {
        if (current === menu) {
          if (hoverOpenedMenu.current === menu) {
            hoverOpenedMenu.current = undefined;
            return current;
          }
          return undefined;
        }
        hoverOpenedMenu.current = undefined;
        return menu;
      });
    },
    [cancelMenuClose],
  );

  const scheduleDesktopMenuClose = useCallback(
    (menu: DesktopMenuID) => {
      cancelMenuClose();
      closeTimer.current = window.setTimeout(() => {
        setOpenMenu((current) => (current === menu ? undefined : current));
        closeTimer.current = undefined;
      }, MENU_CLOSE_DELAY_MS);
    },
    [cancelMenuClose],
  );

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
      if (event.key === "Escape") closeDrawer(true);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => setOpenMobileMenu(activeMobileMenu(pathname)), [pathname]);

  useEffect(() => {
    if (openMenu === undefined) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      const owner =
        target instanceof Element
          ? target.closest<HTMLElement>("[data-desktop-menu]")
          : null;
      if (owner?.dataset.desktopMenu !== openMenu) {
        closeDesktopMenu();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [closeDesktopMenu, openMenu]);

  useEffect(() => () => cancelMenuClose(), [cancelMenuClose]);

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
          <AtlasBrand placement="header" />
        </a>
        <nav className="desktop-navigation" aria-label="Primary navigation">
          {PRIMARY_NAVIGATION.map((item) =>
            isNavigationGroup(item) ? (
              <DesktopGroup
                key={item.label}
                group={item}
                pathname={pathname}
                menuID={desktopMenuID(item)}
                open={openMenu === desktopMenuID(item)}
                triggerRef={(element) => {
                  const menuID = desktopMenuID(item);
                  if (element === null) menuTriggers.current.delete(menuID);
                  else menuTriggers.current.set(menuID, element);
                }}
                onOpen={openDesktopMenu}
                onOpenFromHover={openDesktopMenuFromHover}
                onToggle={toggleDesktopMenu}
                onClose={closeDesktopMenu}
                onScheduleClose={scheduleDesktopMenuClose}
                onCancelClose={cancelMenuClose}
              />
            ) : (
              <ShellLink key={item.href} item={item} pathname={pathname} />
            ),
          )}
        </nav>
        <ThemeControl />
        <fieldset
          className="administration-menu"
          data-desktop-menu="administration"
          onMouseEnter={() => {
            if (openMenu !== "administration")
              openDesktopMenuFromHover("administration");
          }}
          onMouseLeave={() => scheduleDesktopMenuClose("administration")}
          onFocus={cancelMenuClose}
          onBlur={(event) => closeWhenFocusLeaves(event, closeDesktopMenu)}
          onKeyDown={(event) =>
            handleMenuKeyDown(
              event,
              openMenu === "administration",
              () => openDesktopMenu("administration"),
              closeDesktopMenu,
            )
          }
        >
          <legend className="visually-hidden">Administration menu</legend>
          <button
            ref={(element) => {
              if (element === null)
                menuTriggers.current.delete("administration");
              else menuTriggers.current.set("administration", element);
            }}
            className="administration-trigger"
            id="administration-menu-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === "administration"}
            aria-controls="administration-menu"
            onClick={() => toggleDesktopMenu("administration")}
          >
            <span className="administration-identity">
              <strong>{user.displayName}</strong>
              <small>Administration</small>
            </span>
            <span aria-hidden="true">▾</span>
          </button>
          {openMenu === "administration" && (
            <div
              className="nav-popover nav-popover--right"
              id="administration-menu"
              role="menu"
              aria-labelledby="administration-menu-trigger"
              onMouseEnter={cancelMenuClose}
            >
              <p className="menu-identity">{user.email}</p>
              {ADMINISTRATION_NAVIGATION.map((item) => (
                <ShellLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  menuItem
                  onSelect={() => closeDesktopMenu()}
                />
              ))}
              <button
                className="menu-action"
                type="button"
                role="menuitem"
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          )}
        </fieldset>
        <button
          ref={drawerTrigger}
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
            onClick={() => closeDrawer(true)}
          />
          <aside className="mobile-drawer" id="mobile-navigation">
            <div className="drawer-heading">
              <strong>Navigation</strong>
              <button
                className="drawer-close"
                type="button"
                aria-label="Close navigation"
                onClick={() => closeDrawer(true)}
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
                    menuID={desktopMenuID(item)}
                    open={openMobileMenu === desktopMenuID(item)}
                    onToggle={(menuID) =>
                      setOpenMobileMenu((current) =>
                        current === menuID ? undefined : menuID,
                      )
                    }
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
  menuID,
  open,
  triggerRef,
  onOpen,
  onOpenFromHover,
  onToggle,
  onClose,
  onScheduleClose,
  onCancelClose,
}: {
  group: NavigationGroup;
  pathname: string;
  menuID: DesktopMenuID;
  open: boolean;
  triggerRef: (element: HTMLButtonElement | null) => void;
  onOpen: (menu: DesktopMenuID) => void;
  onOpenFromHover: (menu: DesktopMenuID) => void;
  onToggle: (menu: DesktopMenuID) => void;
  onClose: (restoreFocus?: boolean) => void;
  onScheduleClose: (menu: DesktopMenuID) => void;
  onCancelClose: () => void;
}) {
  const active = isGroupActive(group, pathname);
  return (
    <fieldset
      className="nav-menu"
      data-desktop-menu={menuID}
      onMouseEnter={() => {
        if (!open) onOpenFromHover(menuID);
      }}
      onMouseLeave={() => onScheduleClose(menuID)}
      onFocus={onCancelClose}
      onBlur={(event) => closeWhenFocusLeaves(event, onClose)}
      onKeyDown={(event) =>
        handleMenuKeyDown(event, open, () => onOpen(menuID), onClose)
      }
    >
      <legend className="visually-hidden">{group.label} menu</legend>
      <button
        ref={triggerRef}
        id={`desktop-menu-trigger-${menuID}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`desktop-menu-${menuID}`}
        className={active ? "nav-parent nav-parent--current" : "nav-parent"}
        onClick={() => onToggle(menuID)}
      >
        {group.label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="nav-popover"
          id={`desktop-menu-${menuID}`}
          role="menu"
          aria-labelledby={`desktop-menu-trigger-${menuID}`}
          onMouseEnter={onCancelClose}
        >
          {group.children.map((item) => (
            <ShellLink
              key={item.href}
              item={item}
              pathname={pathname}
              menuItem
              onSelect={() => onClose()}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function MobileGroup({
  group,
  pathname,
  menuID,
  open,
  onToggle,
}: {
  group: NavigationGroup;
  pathname: string;
  menuID: DesktopMenuID;
  open: boolean;
  onToggle: (menu: DesktopMenuID) => void;
}) {
  const active = isGroupActive(group, pathname);
  return (
    <div className="mobile-nav-group" data-open={open || undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`mobile-menu-${menuID}`}
        className={active ? "nav-parent nav-parent--current" : "nav-parent"}
        onClick={() => onToggle(menuID)}
      >
        {group.label}
      </button>
      {open && (
        <div className="mobile-nav-children" id={`mobile-menu-${menuID}`}>
          {group.children.map((item) => (
            <ShellLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShellLink({
  item,
  pathname,
  menuItem = false,
  onSelect,
}: {
  item: NavigationLink;
  pathname: string;
  menuItem?: boolean;
  onSelect?: () => void;
}) {
  const current = item.href === pathname;
  return (
    <a
      href={item.href}
      className={current ? "nav-link nav-link--current" : "nav-link"}
      aria-current={current ? "page" : undefined}
      role={menuItem ? "menuitem" : undefined}
      onClick={onSelect}
    >
      {item.label}
    </a>
  );
}

function desktopMenuID(group: NavigationGroup): DesktopMenuID {
  if (group.label === "Settings") return "settings";
  if (group.label === "Filters") return "filters";
  return "ha-controller";
}

function activeMobileMenu(pathname: string): DesktopMenuID | undefined {
  const active = PRIMARY_NAVIGATION.find(
    (item): item is NavigationGroup =>
      isNavigationGroup(item) && isGroupActive(item, pathname),
  );
  return active === undefined ? undefined : desktopMenuID(active);
}

function closeWhenFocusLeaves(
  event: FocusEvent<HTMLElement>,
  close: (restoreFocus?: boolean) => void,
) {
  const next = event.relatedTarget;
  if (!(next instanceof Node) || !event.currentTarget.contains(next)) close();
}

function handleMenuKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  open: boolean,
  openMenu: () => void,
  closeMenu: (restoreFocus?: boolean) => void,
) {
  if (event.key === "Escape" && open) {
    event.preventDefault();
    closeMenu(true);
    return;
  }

  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (!open) {
    const menuRoot = event.currentTarget as HTMLElement;
    openMenu();
    window.requestAnimationFrame(() => {
      const root = menuRoot.querySelector<HTMLElement>('[role="menuitem"]');
      root?.focus();
    });
    return;
  }

  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  let next = event.key === "ArrowUp" ? current - 1 : current + 1;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = items.length - 1;
  if (next < 0) next = items.length - 1;
  if (next >= items.length) next = 0;
  items[next]?.focus();
}
