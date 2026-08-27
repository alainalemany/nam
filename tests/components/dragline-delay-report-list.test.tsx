import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getReports: vi.fn() }));

vi.mock("@/features/dragline-delay-reports/data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/dragline-delay-reports/data")
  >("@/features/dragline-delay-reports/data");
  return { ...actual, getDraglineDelayReports: mocks.getReports };
});

import DraglineDelayReportsPage from "@/app/dragline-delay-reports/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Dragline Delay Report history", () => {
  it("shows Run and Down totals as compact hours and minutes", async () => {
    mocks.getReports.mockResolvedValue([
      {
        id: "report-1",
        operationalWorkDate: new Date("2026-08-18T00:00:00.000Z"),
        shift: "DAY",
        status: "COMPLETED",
        equipmentDisplayName: "Dragline 1",
        equipmentNumber: "DL-1",
        mineName: "Mine A",
        runTimeMinutes: 585,
        downTimeMinutes: 135,
        updatedAt: new Date("2026-08-18T21:00:00.000Z"),
      },
    ]);

    render(await DraglineDelayReportsPage());

    expect(screen.getByText(/9 h 45 min \/ 2 h 15 min/)).toBeInTheDocument();
  });

  it("uses calm status badges without changing lifecycle actions or table rows", async () => {
    mocks.getReports.mockResolvedValue([
      {
        id: "draft-report",
        operationalWorkDate: new Date("2026-08-18T00:00:00.000Z"),
        shift: "DAY",
        status: "DRAFT",
        equipmentDisplayName: "Dragline 1",
        equipmentNumber: "DL-1",
        mineName: "Mine A",
        runTimeMinutes: 720,
        downTimeMinutes: 0,
        updatedAt: new Date("2026-08-18T21:00:00.000Z"),
      },
      {
        id: "completed-report",
        operationalWorkDate: new Date("2026-08-17T00:00:00.000Z"),
        shift: "NIGHT",
        status: "COMPLETED",
        equipmentDisplayName: "Dragline 2",
        equipmentNumber: "DL-2",
        mineName: "Mine A",
        runTimeMinutes: 660,
        downTimeMinutes: 60,
        updatedAt: new Date("2026-08-18T10:00:00.000Z"),
      },
    ]);

    render(await DraglineDelayReportsPage());

    const draftBadge = screen.getByText("Draft");
    const completedBadge = screen.getByText("Completed");
    const draftRow = draftBadge.closest("tr");
    const completedRow = completedBadge.closest("tr");

    expect(draftBadge).toHaveClass(
      "ddr-status-badge",
      "ddr-status-badge--draft",
    );
    expect(completedBadge).toHaveClass(
      "ddr-status-badge",
      "ddr-status-badge--completed",
    );
    expect(draftRow).not.toBeNull();
    expect(completedRow).not.toBeNull();
    expect(draftRow).not.toHaveAttribute("class");
    expect(completedRow).not.toHaveAttribute("class");
    expect(within(draftRow!).getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/dragline-delay-reports/draft-report",
    );
    expect(within(draftRow!).getByRole("link", { name: "Edit Draft" })).toHaveAttribute(
      "href",
      "/dragline-delay-reports/draft-report/edit",
    );
    expect(within(completedRow!).getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/dragline-delay-reports/completed-report",
    );
    expect(
      within(completedRow!).queryByRole("link", { name: "Edit Draft" }),
    ).not.toBeInTheDocument();
  });
});
