import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { type ThemePreference, useTheme } from "./ThemeProvider";

const OPTIONS: readonly {
  value: ThemePreference;
  label: string;
}[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const selected = root.current?.querySelector<HTMLButtonElement>(
      '[role="menuitemradio"][aria-checked="true"]',
    );
    window.requestAnimationFrame(() => selected?.focus());

    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeWhenFocusLeaves);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeWhenFocusLeaves);
    };
  }, [open]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => trigger.current?.focus());
    }
  };

  const choose = (next: ThemePreference) => {
    setPreference(next);
    close(true);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = event.key === "ArrowUp" ? current - 1 : current + 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    items[next]?.focus();
  };

  const selectedLabel = OPTIONS.find(
    (option) => option.value === preference,
  )?.label;

  return (
    <div className="theme-control" ref={root}>
      <button
        className="theme-trigger"
        ref={trigger}
        type="button"
        aria-label={`Theme preference: ${selectedLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-preference-menu"
        title={`Theme: ${selectedLabel}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close(true);
          }
        }}
      >
        <ThemeGlyph preference={preference} />
      </button>
      {open && (
        <div
          className="theme-menu"
          id="theme-preference-menu"
          role="menu"
          aria-label="Theme preference"
          onKeyDown={handleMenuKeyDown}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              onClick={() => choose(option.value)}
            >
              <ThemeGlyph preference={option.value} />
              <span>{option.label}</span>
              <span className="theme-menu__check" aria-hidden="true">
                {preference === option.value ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeGlyph({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }
  if (preference === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" className="theme-glyph__fill" />
    </svg>
  );
}
