import { cleanup, render, screen } from "@testing-library/react";
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
});
