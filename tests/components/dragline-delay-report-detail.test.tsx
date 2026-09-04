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
    downtimeBlocks: [{
      id: "downtime-block-1",
      reportId: "report-1",
      sequence: 1,
      startMinuteOffset: 310,
      durationMinutes: 400,
      description: "Scheduled PM — multiple maintenance and inspection tasks",
      createdAt: new Date(),
      updatedAt: new Date(),
      activities: [
        {
          id: "downtime-activity-1",
          downtimeBlockId: "downtime-block-1",
          sequence: 1,
          delayCodeCatalogVersion: 1,
          delayCode: "35",
          delayCodeDescription: "Startup Check",
          delayCodeCategory: "OPERATIONAL",
          description: "Startup inspection and grease checks",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "downtime-activity-2",
          downtimeBlockId: "downtime-block-1",
          sequence: 2,
          delayCodeCatalogVersion: 1,
          delayCode: "36",
          delayCodeDescription: "Daily PM",
          delayCodeCategory: "OPERATIONAL",
          description: "Bucket greasing and routine service",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
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

  it("renders a Shared Downtime Block once with ordered child codes and notes", async () => {
    mocks.getReport.mockResolvedValue(completedReport());
    render(
      await DraglineDelayReportDetailPage({
        params: Promise.resolve({ id: "report-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Shared Downtime Block")).toBeInTheDocument();
    expect(screen.getByText("6 h 40 min downtime")).toBeInTheDocument();
    expect(
      screen.getByText("Scheduled PM — multiple maintenance and inspection tasks"),
    ).toBeInTheDocument();
    expect(screen.getByText("35 — Startup Check")).toBeInTheDocument();
    expect(screen.getByText("Startup inspection and grease checks")).toBeInTheDocument();
    expect(screen.getByText("36 — Daily PM")).toBeInTheDocument();
    expect(screen.getByText("Bucket greasing and routine service")).toBeInTheDocument();
    expect(
      screen.getByText(/Child activities add no separate downtime/),
    ).toBeInTheDocument();

    const blockTime = screen.getByText("5:10 AM");
    const shiftChangeTime = screen.getByText("4:59 PM");
    expect(
      blockTime.compareDocumentPosition(shiftChangeTime) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the persisted mixed manual order instead of regrouping or re-sorting items", async () => {
    const report = completedReport();
    mocks.getReport.mockResolvedValue({
      ...report,
      timelineEntries: [
        {
          ...report.timelineEntries[0],
          id: "timeline-early",
          sequence: 1,
          startMinuteOffset: 323,
          delayCode: "26",
          delayCodeDescription: "Surveying",
          description: "First normal item",
        },
        {
          ...report.timelineEntries[0],
          id: "timeline-later-sequence",
          sequence: 3,
          startMinuteOffset: 320,
          delayCode: "34",
          delayCodeDescription: "Other (Explain)",
          description: "Third persisted item",
        },
      ],
      downtimeBlocks: [
        {
          ...report.downtimeBlocks[0],
          sequence: 2,
          startMinuteOffset: 335,
          description: "Second persisted block",
        },
      ],
    });
    render(
      await DraglineDelayReportDetailPage({
        params: Promise.resolve({ id: "report-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const first = screen.getByText("First normal item");
    const second = screen.getByText("Second persisted block");
    const third = screen.getByText("Third persisted item");
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      second.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
