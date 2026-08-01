// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleEditor } from "./ScheduleEditor";

afterEach(cleanup);

describe("schedule editor", () => {
  it("edits seven-day inactivity periods and displays inline validation", () => {
    const change = vi.fn();
    render(
      <ScheduleEditor
        label="Blocked-services inactivity schedule"
        value={{ timeZone: "Pacific/Auckland", days: {} }}
        errors={[
          "shared.services.blockedSchedule.days.mon: must be a valid range",
        ]}
        onChange={change}
      />,
    );
    fireEvent.click(screen.getByLabelText("Monday"));
    expect(change).toHaveBeenCalledWith({
      timeZone: "Pacific/Auckland",
      days: { mon: { start: 0, end: 86_400_000 } },
    });
    expect(screen.getByRole("alert").textContent).toContain("valid range");
    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "UTC" },
    });
    expect(change).toHaveBeenLastCalledWith({ timeZone: "UTC", days: {} });
  });
});
