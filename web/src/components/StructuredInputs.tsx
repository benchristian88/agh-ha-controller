import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { CapabilityWarning, Field } from "./Settings";

type ValidationResult = string | undefined;

interface ListFieldProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  validate: (value: string) => ValidationResult;
  placeholder?: string;
  addLabel?: string;
  help?: ReactNode;
  disabled?: boolean;
  stale?: boolean;
  unsupported?: boolean;
  emptyMessage?: string;
}

function StructuredListField({
  label,
  value,
  onChange,
  validate,
  placeholder,
  addLabel = "Add",
  help,
  disabled = false,
  stale = false,
  unsupported = false,
  emptyMessage = "No entries.",
}: ListFieldProps) {
  const id = useId();
  const [nextValue, setNextValue] = useState("");
  const nextRowKey = useRef(0);
  const rowKeys = useRef<string[]>([]);
  while (rowKeys.current.length < value.length) {
    nextRowKey.current += 1;
    rowKeys.current.push(`${id}-row-${nextRowKey.current}`);
  }
  if (rowKeys.current.length > value.length) {
    rowKeys.current = rowKeys.current.slice(0, value.length);
  }
  const rows = value.map((item, index) => ({
    item,
    index,
    key: rowKeys.current[index] ?? `${id}-row-fallback`,
  }));
  const nextError = nextValue === "" ? undefined : validate(nextValue);

  function add() {
    const trimmed = nextValue.trim();
    if (trimmed === "" || validate(trimmed) !== undefined) return;
    onChange([...value, trimmed]);
    setNextValue("");
  }

  function addOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  return (
    <fieldset className="list-field" disabled={disabled || unsupported}>
      <legend>{label}</legend>
      {help !== undefined && <p className="field__help">{help}</p>}
      {stale && (
        <CapabilityWarning state="stale">
          Refresh capability data before relying on these entries.
        </CapabilityWarning>
      )}
      {unsupported && (
        <CapabilityWarning state="unsupported">
          This control is unavailable for the selected scope.
        </CapabilityWarning>
      )}
      {value.length === 0 && (
        <p className="list-field__empty">{emptyMessage}</p>
      )}
      <div className="list-field__rows">
        {rows.map(({ item, index, key }) => {
          const error = validate(item);
          const errorID = `${id}-${index}-error`;
          return (
            <div className="list-field__row" key={key}>
              <div>
                <label className="visually-hidden" htmlFor={`${id}-${index}`}>
                  {label} entry {index + 1}
                </label>
                <input
                  id={`${id}-${index}`}
                  value={item}
                  aria-invalid={error !== undefined}
                  aria-describedby={error === undefined ? undefined : errorID}
                  onChange={(event) =>
                    onChange(
                      value.map((current, currentIndex) =>
                        currentIndex === index ? event.target.value : current,
                      ),
                    )
                  }
                />
                {error !== undefined && (
                  <span className="field__error" id={errorID}>
                    {error}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="button button--quiet"
                aria-label={`Remove ${item || `entry ${index + 1}`}`}
                onClick={() => {
                  rowKeys.current.splice(index, 1);
                  onChange(
                    value.filter((_, currentIndex) => currentIndex !== index),
                  );
                }}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
      <div className="list-field__add">
        <div>
          <label className="visually-hidden" htmlFor={`${id}-new`}>
            New {label} entry
          </label>
          <input
            id={`${id}-new`}
            value={nextValue}
            placeholder={placeholder}
            aria-invalid={nextError !== undefined}
            onChange={(event) => setNextValue(event.target.value)}
            onKeyDown={addOnEnter}
          />
          {nextError !== undefined && (
            <span className="field__error">{nextError}</span>
          )}
        </div>
        <button
          type="button"
          className="button button--secondary"
          disabled={nextValue.trim() === "" || nextError !== undefined}
          onClick={add}
        >
          {addLabel}
        </button>
      </div>
    </fieldset>
  );
}

export interface DurationPreset {
  label: string;
  value: number;
}

export function DurationField({
  label,
  value,
  unit,
  presets,
  onChange,
  min = 0,
  max,
  disabled = false,
  help,
}: {
  label: string;
  value: number;
  unit: "seconds" | "minutes" | "hours" | "days";
  presets: readonly DurationPreset[];
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  help?: ReactNode;
}) {
  const id = useId();
  const presetValue = presets.some((preset) => preset.value === value)
    ? String(value)
    : "custom";
  const invalid =
    !Number.isFinite(value) ||
    value < min ||
    (max !== undefined && value > max);
  return (
    <Field
      label={label}
      htmlFor={`${id}-preset`}
      help={help}
      error={
        invalid
          ? `Enter a value from ${min}${max === undefined ? " or greater" : ` to ${max}`}.`
          : undefined
      }
    >
      <div className="duration-field">
        <select
          id={`${id}-preset`}
          value={presetValue}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value !== "custom")
              onChange(Number(event.target.value));
          }}
        >
          {presets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {presetValue === "custom" && (
          <div className="duration-field__custom">
            <label className="visually-hidden" htmlFor={`${id}-custom`}>
              Custom {label.toLowerCase()}
            </label>
            <input
              id={`${id}-custom`}
              type="number"
              value={Number.isFinite(value) ? value : ""}
              min={min}
              max={max}
              disabled={disabled}
              aria-invalid={invalid}
              onChange={(event) =>
                onChange(
                  event.target.value === ""
                    ? Number.NaN
                    : Number(event.target.value),
                )
              }
            />
            <span>{unit}</span>
          </div>
        )}
      </div>
    </Field>
  );
}

export function NetworkListField(
  props: Omit<ListFieldProps, "validate"> & {
    allowIp?: boolean;
    allowCidr?: boolean;
  },
) {
  const { allowIp = true, allowCidr = true, ...rest } = props;
  return (
    <StructuredListField
      {...rest}
      validate={(value) => validateNetwork(value, allowIp, allowCidr)}
    />
  );
}

export function DomainListField(
  props: Omit<ListFieldProps, "validate"> & { allowWildcard?: boolean },
) {
  const { allowWildcard = false, ...rest } = props;
  return (
    <StructuredListField
      {...rest}
      validate={(value) => validateDomain(value, allowWildcard)}
    />
  );
}

export function UrlListField(props: Omit<ListFieldProps, "validate">) {
  return <StructuredListField {...props} validate={validateHttpUrl} />;
}

export type IdentifierKind = "ip" | "cidr" | "mac" | "clientId";

export function IdentifierListEditor({
  allowedKinds = ["ip", "cidr", "mac", "clientId"],
  ...props
}: Omit<ListFieldProps, "validate"> & {
  allowedKinds?: readonly IdentifierKind[];
}) {
  return (
    <StructuredListField
      {...props}
      validate={(value) => validateIdentifier(value, allowedKinds)}
    />
  );
}

export function OrderedTextEditor({
  label,
  value,
  onChange,
  help,
  rows = 10,
  disabled = false,
  validateLine,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  help?: ReactNode;
  rows?: number;
  disabled?: boolean;
  validateLine?: (value: string, index: number) => ValidationResult;
  placeholder?: string;
}) {
  const id = useId();
  const errors = value
    .map((line, index) => validateLine?.(line, index))
    .filter((error): error is string => error !== undefined);
  return (
    <Field
      label={label}
      htmlFor={id}
      help={help}
      error={errors.length > 0 ? errors[0] : undefined}
    >
      <textarea
        id={id}
        className="ordered-text-editor monospace"
        rows={rows}
        value={value.join("\n")}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={errors.length > 0}
        onChange={(event) => onChange(event.target.value.split("\n"))}
      />
      <div className="editor-meta">
        {value.filter((line) => line.trim() !== "").length} lines · order is
        preserved
      </div>
    </Field>
  );
}

export function RuleEditor(
  props: Omit<Parameters<typeof OrderedTextEditor>[0], "validateLine"> & {
    validateRule?: (value: string, index: number) => ValidationResult;
  },
) {
  return (
    <OrderedTextEditor
      {...props}
      help={
        props.help ??
        "One AdGuard filtering rule per line. Comments and rule order are preserved."
      }
      validateLine={props.validateRule ?? validateRule}
    />
  );
}

export function UpstreamEditor(
  props: Omit<Parameters<typeof OrderedTextEditor>[0], "validateLine"> & {
    validateUpstream?: (value: string, index: number) => ValidationResult;
  },
) {
  return (
    <OrderedTextEditor
      {...props}
      help={
        props.help ??
        "Enter one AdGuard upstream expression per line. Order is preserved."
      }
      validateLine={props.validateUpstream ?? validateUpstream}
    />
  );
}

export function validateNetwork(
  value: string,
  allowIp = true,
  allowCidr = true,
): ValidationResult {
  const candidate = value.trim();
  if (candidate === "") return "Enter an IP address or CIDR network.";
  if (candidate.includes("/")) {
    if (!allowCidr) return "CIDR networks are not allowed here.";
    const parts = candidate.split("/");
    if (
      parts.length !== 2 ||
      parts[0] === undefined ||
      parts[1] === undefined ||
      !isIpAddress(parts[0])
    )
      return "Enter a valid CIDR network.";
    const prefix = Number(parts[1]);
    const limit = parts[0].includes(":") ? 128 : 32;
    return Number.isInteger(prefix) && prefix >= 0 && prefix <= limit
      ? undefined
      : `CIDR prefix must be from 0 to ${limit}.`;
  }
  if (!allowIp) return "Individual IP addresses are not allowed here.";
  return isIpAddress(candidate)
    ? undefined
    : "Enter a valid IPv4 or IPv6 address.";
}

export function validateDomain(
  value: string,
  allowWildcard = false,
): ValidationResult {
  let candidate = value.trim().toLowerCase();
  if (allowWildcard && candidate.startsWith("*."))
    candidate = candidate.slice(2);
  else if (candidate.includes("*")) return "Wildcards are not allowed here.";
  if (candidate.length === 0 || candidate.length > 253)
    return "Enter a valid domain name.";
  const labels = candidate.endsWith(".")
    ? candidate.slice(0, -1).split(".")
    : candidate.split(".");
  if (
    labels.some(
      (part) =>
        part.length === 0 ||
        part.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part),
    )
  )
    return "Enter a valid domain name.";
  return undefined;
}

export function validateHttpUrl(value: string): ValidationResult {
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol))
      return "Use an HTTP or HTTPS URL.";
    if (parsed.username !== "" || parsed.password !== "")
      return "URLs containing credentials are not allowed.";
    return undefined;
  } catch {
    return "Enter a valid HTTP or HTTPS URL.";
  }
}

export function validateIdentifier(
  value: string,
  allowedKinds: readonly IdentifierKind[] = ["ip", "cidr", "mac", "clientId"],
): ValidationResult {
  const candidate = value.trim();
  if (candidate === "") return "Enter an identifier.";
  if (
    candidate.includes("/") &&
    validateNetwork(candidate, false, true) !== undefined
  )
    return "Enter a valid IP, CIDR, MAC address, or ClientID.";
  if (/^[0-9.]+$/.test(candidate) && !isIpAddress(candidate))
    return "Enter a valid IP, CIDR, MAC address, or ClientID.";
  const kind: IdentifierKind | undefined =
    candidate.includes("/") &&
    validateNetwork(candidate, false, true) === undefined
      ? "cidr"
      : isIpAddress(candidate)
        ? "ip"
        : /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(candidate)
          ? "mac"
          : /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate)
            ? "clientId"
            : undefined;
  if (kind === undefined)
    return "Enter a valid IP, CIDR, MAC address, or ClientID.";
  return allowedKinds.includes(kind)
    ? undefined
    : `${identifierLabel(kind)} identifiers are not allowed here.`;
}

function identifierLabel(kind: IdentifierKind): string {
  return kind === "clientId" ? "ClientID" : kind.toUpperCase();
}

function isIpAddress(value: string): boolean {
  if (value.includes(":")) {
    try {
      return new URL(`http://[${value}]/`).hostname !== "";
    } catch {
      return false;
    }
  }
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255,
    )
  );
}

function validateRule(value: string, index: number): ValidationResult {
  if (value.trim() === "") return undefined;
  return /[\r\n]/.test(value)
    ? `Rule ${index + 1} must stay on one line.`
    : undefined;
}

function validateUpstream(value: string, index: number): ValidationResult {
  const candidate = value.trim();
  if (candidate === "") return undefined;
  return /\s/.test(candidate)
    ? `Upstream ${index + 1} cannot contain whitespace.`
    : undefined;
}
