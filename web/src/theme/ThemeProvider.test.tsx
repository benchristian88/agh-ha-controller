// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasBrand } from "../components/Brand";
import { ThemeControl } from "./ThemeControl";
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  ThemeProvider,
  useTheme,
} from "./ThemeProvider";
import { installMatchMedia } from "./testMatchMedia";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  document.querySelector('meta[name="theme-color"]')?.remove();
  vi.unstubAllGlobals();
});

function ThemeState() {
  const { preference, resolvedTheme } = useTheme();
  return <output>{`${preference}:${resolvedTheme}`}</output>;
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeControl />
      <ThemeState />
      <AtlasBrand placement="header" />
    </ThemeProvider>,
  );
}

describe("theme preference", () => {
  it("defaults to System and follows OS theme changes", async () => {
    const media = installMatchMedia(false);
    const { container } = renderTheme();

    expect(
      screen.getByRole("button", {
        name: "Theme preference: System",
      }),
    ).toBeTruthy();
    expect(screen.getByText("system:light")).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("light");

    media.setMatches(true);
    await waitFor(() => expect(screen.getByText("system:dark")).toBeTruthy());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      container.querySelector<HTMLImageElement>(".atlas-brand__lockup")?.src,
    ).toContain("atlas-dns-lockup-dark.svg");
  });

  it("persists explicit selection and ignores later OS changes", async () => {
    const media = installMatchMedia(false);
    const user = userEvent.setup();
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.append(themeColor);
    renderTheme();

    const trigger = screen.getByRole("button", {
      name: "Theme preference: System",
    });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("dark");
    expect(themeColor.content).toBe(THEME_COLORS.dark);
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    media.setMatches(false);
    expect(screen.getByText("dark:dark")).toBeTruthy();
  });

  it("restores a saved preference and rejects invalid stored values", () => {
    installMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const first = renderTheme();
    expect(screen.getByText("light:light")).toBeTruthy();
    first.unmount();

    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderTheme();
    expect(screen.getByText("system:dark")).toBeTruthy();
  });

  it("supports keyboard theme selection and Escape focus return", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    renderTheme();
    const trigger = screen.getByRole("button", {
      name: "Theme preference: System",
    });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu", { name: "Theme preference" })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("System"),
    );
    await user.keyboard("{Home}{Enter}");
    expect(screen.getByText("light:light")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.click(
      screen.getByRole("button", { name: "Theme preference: Light" }),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Theme preference" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
