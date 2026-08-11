import { useTheme } from "./ThemeProvider";

export function ThemeControl() {
  const { preference, setPreference } = useTheme();

  return (
    <label className="theme-control">
      <span>Theme</span>
      <select
        aria-label="Theme preference"
        value={preference}
        onChange={(event) =>
          setPreference(event.target.value as "system" | "light" | "dark")
        }
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
