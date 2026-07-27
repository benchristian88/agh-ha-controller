import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, Loading } from "../../components/Feedback";
import { api } from "../../lib/api";
import type { AuditEvent } from "../../lib/types";

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>();
  const [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    try {
      setEvents((await api.auditEvents()).items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">System</p>
          <h1>Audit log</h1>
          <p className="muted">
            Durable security and node-management activity.
          </p>
        </div>
      </header>
      {events === undefined && error === undefined && (
        <Loading label="Loading audit events…" />
      )}
      {events === undefined && error !== undefined && (
        <ErrorState error={error} retry={() => void load()} />
      )}
      {events?.length === 0 && (
        <EmptyState title="No audit events">
          <p>Material actions will appear here.</p>
        </EmptyState>
      )}
      {events !== undefined && events.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Actor</th>
                <th>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>
                    <strong>{event.action}</strong>
                  </td>
                  <td>
                    {event.resourceType}
                    <span className="table-subtitle monospace">
                      {event.resourceId ?? "—"}
                    </span>
                  </td>
                  <td>{event.actorType}</td>
                  <td className="monospace">{event.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
