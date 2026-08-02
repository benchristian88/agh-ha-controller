import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

export type FeedbackTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export function Banner({
  tone = "info",
  title,
  children,
  actions,
}: {
  tone?: FeedbackTone;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`banner banner--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div>
        {title !== undefined && (
          <strong className="banner__title">{title}</strong>
        )}
        <div className="banner__content">{children}</div>
      </div>
      {actions !== undefined && (
        <div className="banner__actions">{actions}</div>
      )}
    </section>
  );
}

export function Toast({
  tone = "neutral",
  message,
  onDismiss,
}: {
  tone?: FeedbackTone;
  message: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`toast toast--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div>{message}</div>
      {onDismiss !== undefined && (
        <button
          type="button"
          className="toast__dismiss"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({
  label = "Loading…",
  rows = 3,
  compact = false,
}: {
  label?: string;
  rows?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`loading-skeleton${compact ? " loading-skeleton--compact" : ""}`}
      role="status"
      aria-label={label}
    >
      <span className="visually-hidden">{label}</span>
      {Array.from(
        { length: rows },
        (_, index) => `skeleton-row-${index + 1}`,
      ).map((rowKey) => (
        <span className="loading-skeleton__row" key={rowKey} />
      ))}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  retry,
  title = "Unable to load this content",
}: {
  error: unknown;
  retry?: () => void;
  title?: string;
}) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <section className="state-panel state-panel--error" role="alert">
      <div className="state-panel__icon" aria-hidden="true">
        !
      </div>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {requestId !== undefined && <small>Request ID: {requestId}</small>}
        {retry !== undefined && (
          <button
            type="button"
            className="button button--secondary"
            onClick={retry}
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
  filtered = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  filtered?: boolean;
}) {
  return (
    <section className="empty-state" data-filtered={filtered || undefined}>
      <div className="state-panel__icon" aria-hidden="true">
        {filtered ? "⌕" : "–"}
      </div>
      <h2>{title}</h2>
      {children !== undefined && <div>{children}</div>}
      {action !== undefined && (
        <div className="empty-state__action">{action}</div>
      )}
    </section>
  );
}
