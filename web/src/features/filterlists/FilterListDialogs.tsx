import type { RefObject } from "react";
import { Banner } from "../../components/Feedback";
import {
  ConfirmDialog,
  Dialog,
  OperationalCommandDialog,
} from "../../components/Overlays";
import { Field } from "../../components/Settings";
import { StatusBadge } from "../../components/StatusBadge";
import { filterListNodeStatus, formatTimestamp } from "./FilterListTable";
import type { FilterListRow } from "./model";

export interface FilterListEditorState {
  mode: "add" | "edit";
  previousURL?: string;
  value: string;
}

export function FilterListEditorDialog({
  editor,
  error,
  noun,
  inputRef,
  onChange,
  onClose,
  onSubmit,
}: {
  editor?: FilterListEditorState;
  error?: string;
  noun: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const formID = `${noun}-editor`;
  const inputID = `${noun}-url`;
  const titleNoun = titleCase(noun);
  return (
    <Dialog
      open={editor !== undefined}
      onClose={onClose}
      title={editor?.mode === "edit" ? `Edit ${noun}` : `Add ${noun}`}
      description="This updates the mutable draft only. Nodes remain unchanged until publish and deploy."
      initialFocusRef={inputRef}
      actions={
        <>
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" form={formID} className="button">
            Save to draft
          </button>
        </>
      }
    >
      <form
        id={formID}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Field
          label={`${titleNoun} URL`}
          htmlFor={inputID}
          required
          error={error}
          help="Use an absolute HTTP or HTTPS URL. Local file paths are not assumed portable across nodes and cannot be added to desired state."
        >
          <input
            ref={inputRef}
            id={inputID}
            type="text"
            inputMode="url"
            value={editor?.value ?? ""}
            aria-invalid={error !== undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
        <Banner tone="info" title="Name is observed metadata">
          AdGuard Home reports the list name. The controller does not put that
          node-managed label into the desired configuration or its hash.
        </Banner>
        {editor?.mode === "edit" &&
          editor.value.trim() !== editor.previousURL && (
            <Banner tone="warning" title="Effective reconciliation preview">
              Deployment will add and enable the new URL, then disable the old
              URL where it remains enabled. The old node entry is not deleted.
            </Banner>
          )}
      </form>
    </Dialog>
  );
}

export function FilterListRemoveDialog({
  row,
  noun,
  onClose,
  onConfirm,
}: {
  row?: FilterListRow;
  noun: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={row !== undefined}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Remove ${noun} from desired configuration?`}
      description={row?.name}
      confirmLabel="Remove from draft"
    >
      <p>
        This removes <span className="monospace">{row?.url}</span> from the
        mutable draft. Saving does not change nodes. If this draft is published
        and deployed, the controller disables the list on managed nodes and does
        not delete it.
      </p>
    </ConfirmDialog>
  );
}

export function FilterListRefreshDialog({
  open,
  noun,
  targetCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  noun: string;
  targetCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <OperationalCommandDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      command={`Refresh all ${noun}s`}
      scope={`${targetCount} enabled node(s) outside maintenance`}
      impact={`Every enabled ${noun} subscription on each target node is refreshed. The command is audited per node and creates no configuration revision.`}
    />
  );
}

export function FilterListResultsDialog({
  row,
  noun,
  onClose,
}: {
  row?: FilterListRow;
  noun: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={row !== undefined}
      onClose={onClose}
      title={row?.name ?? `Per-node ${noun} results`}
      description={row?.url}
      size="large"
      actions={
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Node</th>
              <th>Application</th>
              <th>Name</th>
              <th>Rules</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {(row?.nodes ?? []).map((node) => (
              <tr key={node.nodeId}>
                <td>
                  <strong>{node.nodeName}</strong>
                  {node.errorCode && (
                    <span className="table-subtitle">{node.errorCode}</span>
                  )}
                </td>
                <td>
                  <StatusBadge
                    status={filterListNodeStatus(node, row?.desired ?? false)}
                  />
                </td>
                <td>{node.list?.name || "Not observed"}</td>
                <td>{node.list?.ruleCount.toLocaleString() ?? "—"}</td>
                <td>{formatTimestamp(node.list?.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
