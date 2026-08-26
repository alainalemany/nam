import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getReport: vi.fn() }));

vi.mock("@/features/dragline-delay-reports/data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/dragline-delay-reports/data")
  >("@/features/dragline-delay-reports/data");
  return { ...actual, getDraglineDelayReportById: mocks.getReport };
});

import DraglineDelayReportDetailPage from "@/app/dragline-delay-reports/[id]/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completedReport() {
  return {
    id: "report-1",
    status: "COMPLETED",
    operationalWorkDate: new Date("2026-08-18T00:00:00.000Z"),
    shift: "DAY",
    equipmentId: "dragline-1",
    equipmentDisplayName: "Dragline 1",
    equipmentNumber: "DL-1",
    equipmentCategory: "DRAGLINE",
    mineName: "Mine A",
    cityName: "City A",
    cityState: "FL",
    startingHourMeter: 12345,
    endingHourMeter: 12356,
    supervisorId: "supervisor-1",
    supervisorDisplayName: "Sam Supervisor",
    supervisorEmployeeCode: "200",
    lakeId: null,
    lakeDisplayNameSnapshot: null,
    normalDiggingBuckets: null,
    benchfillBuckets: null,
    stationStartFeet: 1600,
    stationEndFeet: 1620,
    depthFeet: null,
    fuelGallons: null,
    cableDragFeet: null,
    hoistFeet: null,
    comments: null,
    safetyItemsFound: null,
    actionTaken: null,
    downTimeMinutes: 135,
    runTimeMinutes: 585,
    recordVersion: 3,
    completedAt: new Date("2026-08-18T21:00:00.000Z"),
    createdAt: new Date("2026-08-18T09:00:00.000Z"),
    updatedAt: new Date("2026-08-18T21:30:00.000Z"),
    operators: [{
      id: "operator-row-1",
      reportId: "report-1",
      sequence: 1,
      employeeId: "operator-1",
      employeeDisplayName: "Alex Operator",
      employeeCode: "100",
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
    timelineEntries: [{
      id: "timeline-1",
      reportId: "report-1",
      sequence: 1,
      startMinuteOffset: 1019,
      delayCodeCatalogVersion: 1,
      delayCode: "13",
      delayCodeDescription: "Shift Change",
      delayCodeCategory: "OPERATIONAL",
      description: null,
      durationMinutes: null,
      causesDowntime: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }],
    groundChecks: [],
    corrections: [{
      id: "correction-1",
      reportId: "report-1",
      sequence: 1,
      reason: "Corrected Ending Hour Meter from signed shift paperwork.",
      previousRecordVersion: 2,
      resultingRecordVersion: 3,
      correctedAt: new Date("2026-08-18T21:30:00.000Z"),
    }],
  };
}

describe("Dragline Delay Report Completed detail", () => {
  it("keeps Draft status above a date-first heading and secondary machine name", async () => {
    mocks.getReport.mockResolvedValue({
      ...completedReport(),
      status: "DRAFT",
      recordVersion: 2,
      completedAt: null,
      corrections: [],
    });
    render(
      await DraglineDelayReportDetailPage({
        params: Promise.resolve({ id: "report-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Draft · Version 2")).toHaveClass("eyebrow");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "August 18, 2026 · Day shift",
    });
    expect(heading.nextElementSibling).toHaveTextContent("Dragline 1");
    expect(heading.nextElementSibling).toHaveClass("summary");
  });

  it("is read-only by default and displays completion and correction history", async () => {
    mocks.getReport.mockResolvedValue(completedReport());
    render(
      await DraglineDelayReportDetailPage({
        params: Promise.resolve({ id: "report-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText(/Completed · Version 3/)).toBeInTheDocument();
    const primaryHeading = screen.getByRole("heading", {
      level: 1,
      name: "August 18, 2026 · Day shift",
    });
    const machineSummary = screen.getByText("Dragline 1", {
      selector: "p.summary",
    });
    expect(primaryHeading.nextElementSibling).toBe(machineSummary);
    expect(screen.getByRole("link", { name: "Correct Report" })).toHaveAttribute(
      "href",
      "/dragline-delay-reports/report-1/correct",
    );
    expect(screen.queryByRole("link", { name: "Edit Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save Draft/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Correction History" })).toBeInTheDocument();
    expect(
      screen.getByText("Corrected Ending Hour Meter from signed shift paperwork."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 → 3")).toBeInTheDocument();
    expect(screen.getByText("Section Start")).toBeInTheDocument();
    expect(screen.getByText("Section End")).toBeInTheDocument();
    expect(screen.getByText("16+00")).toBeInTheDocument();
    expect(screen.getByText("16+20")).toBeInTheDocument();
    expect(screen.getByText("9 h 45 min")).toBeInTheDocument();
    expect(screen.getByText("2 h 15 min")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Report Context",
      "Operational Timeline",
      "Production and Progress",
      "Ground Checks",
      "Closing Notes",
      "Correction History",
    ]);
  });

  it.each([
    ["completed", "Report completed successfully."],
    ["corrected", "Report corrected successfully."],
  ])("shows a clear %s success confirmation", async (saved, message) => {
    mocks.getReport.mockResolvedValue(completedReport());
    render(
      await DraglineDelayReportDetailPage({
        params: Promise.resolve({ id: "report-1" }),
        searchParams: Promise.resolve({ saved }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
});
