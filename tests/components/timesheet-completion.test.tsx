import { cleanup, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ useActionState: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return { ...actual, useActionState: hooks.useActionState };
});
vi.mock("@/features/timesheets/actions", () => ({
  completeWeeklyTimesheetAction: vi.fn(),
  deleteWeeklyTimesheetAction: vi.fn(),
  reopenWeeklyTimesheetAction: vi.fn(),
}));

import { CompleteTimesheetButton } from "@/features/timesheets/TimesheetLifecycleActions";

afterEach(cleanup);
beforeEach(() => {
  hooks.useActionState.mockReset();
  hooks.useActionState.mockReturnValue([{ ok: true, message: "" }, vi.fn(), false]);
});

describe("Timesheet completion confirmation", () => {
  it("summarizes the week and prevents confirmation while validation issues remain", () => {
    render(<CompleteTimesheetButton
      id="timesheet-1"
      weekLabel="October 5–11, 2026"
      workedTime="36h"
      ftoSummary="No FTO requests"
      noWorkSummary="October 5 · Shift canceled; October 9 · Covered by coworker"
      issues={["October 7 needs a Work Allocation."]}
    />);

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByText("Complete October 5–11, 2026?")).toBeInTheDocument();
    expect(within(dialog).getByText("36h")).toBeInTheDocument();
    expect(within(dialog).getByText(/October 5 · Shift canceled/)).toBeInTheDocument();
    expect(within(dialog).getByText("October 7 needs a Work Allocation.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm completion", hidden: true })).toBeDisabled();
  });

  it("keeps a server completion failure visible inside the confirmation dialog", () => {
    hooks.useActionState.mockReturnValueOnce([
      { ok: false, message: "A scheduled date is still unexplained." },
      vi.fn(),
      false,
    ]);

    render(<CompleteTimesheetButton
      id="timesheet-1"
      weekLabel="October 5–11, 2026"
      workedTime="36h"
      ftoSummary="No FTO requests"
      noWorkSummary="No explained no-work dates"
      issues={[]}
    />);

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("alert", { hidden: true })).toHaveTextContent(
      "A scheduled date is still unexplained.",
    );
  });
});
