import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

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
}: {
  error: unknown;
  retry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="notice notice--error" role="alert">
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
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
