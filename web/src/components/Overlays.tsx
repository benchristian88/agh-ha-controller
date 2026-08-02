import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  size?: "small" | "medium" | "large";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  closeLabel = "Close dialog",
  initialFocusRef,
  dismissible = true,
  size = "medium",
}: DialogProps) {
  const titleID = useId();
  const descriptionID = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const focusTimer = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        focusableElements(panelRef.current)[0] ??
        panelRef.current;
      target?.focus();
    });
    return () => {
      window.clearTimeout(focusTimer);
      returnFocus?.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = focusableElements(panelRef.current);
    if (elements.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <div className="dialog-layer">
      <button
        type="button"
        className="dialog-backdrop"
        aria-label="Dismiss dialog"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={`dialog dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleID}
        aria-describedby={description === undefined ? undefined : descriptionID}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="dialog__header">
          <div>
            <h2 id={titleID}>{title}</h2>
            {description !== undefined && (
              <div id={descriptionID} className="muted">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              className="dialog__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </header>
        <div className="dialog__body">{children}</div>
        {actions !== undefined && (
          <footer className="dialog__actions">{actions}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmationText,
  busy = false,
  confirmDisabled = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmationText?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  danger?: boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const valid = confirmationText === undefined || typed === confirmationText;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      dismissible={!busy}
      actions={
        <>
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "button button--danger" : "button"}
            disabled={busy || confirmDisabled || !valid}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {confirmationText !== undefined && (
        <label className="confirm-dialog__phrase">
          Type <strong>{confirmationText}</strong> to continue
          <input
            value={typed}
            autoComplete="off"
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
      )}
    </Dialog>
  );
}

export function OperationalCommandDialog({
  open,
  onClose,
  onConfirm,
  command,
  scope,
  impact,
  target,
  cluster,
  consequence,
  recoverable,
  confirmationText,
  busy = false,
  confirmDisabled = false,
  destructive = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  command: string;
  scope?: string;
  impact?: ReactNode;
  target?: string;
  cluster?: string;
  consequence?: ReactNode;
  recoverable?: ReactNode;
  confirmationText?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={command}
      description="This is an immediate operational command. It is not Save Draft, Publish, or Deploy. Operational commands do not modify the configuration draft or desired state."
      confirmLabel={command}
      confirmationText={confirmationText}
      busy={busy}
      confirmDisabled={confirmDisabled}
      danger={destructive}
    >
      <dl className="operational-command-summary">
        {target !== undefined && (
          <div>
            <dt>Exact node</dt>
            <dd>{target}</dd>
          </div>
        )}
        {cluster !== undefined && (
          <div>
            <dt>Current cluster</dt>
            <dd>{cluster}</dd>
          </div>
        )}
        {target !== undefined && (
          <div>
            <dt>Action</dt>
            <dd>{command}</dd>
          </div>
        )}
        {consequence !== undefined && (
          <div>
            <dt>Consequence</dt>
            <dd>{consequence}</dd>
          </div>
        )}
        {recoverable !== undefined && (
          <div>
            <dt>Recoverable</dt>
            <dd>{recoverable}</dd>
          </div>
        )}
        {scope !== undefined && (
          <div>
            <dt>Target scope</dt>
            <dd>{scope}</dd>
          </div>
        )}
        {impact !== undefined && (
          <div>
            <dt>Expected impact</dt>
            <dd>{impact}</dd>
          </div>
        )}
      </dl>
      {children}
    </ConfirmDialog>
  );
}

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden"));
}
