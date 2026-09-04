import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    draglineDelayReport: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  draglineDelayReportToFormInitial,
  getDraglineDelayReportById,
  getDraglineDelayReports,
} from "@/features/dragline-delay-reports/data";

afterEach(() => {
  vi.clearAllMocks();
});

function persistedReport(status: "DRAFT" | "COMPLETED") {
  return {
    id: `${status.toLowerCase()}-report`,
    status,
    shift: "DAY",
    downTimeMinutes: 40,
    runTimeMinutes: 680,
    timelineEntries: [{
      startMinuteOffset: 370,
      durationMinutes: 30,
      causesDowntime: true,
      delayCode: "15",
    }, {
      startMinuteOffset: 1010,
      durationMinutes: 15,
      causesDowntime: true,
      delayCode: "13",
    }],
    groundChecks: [{ startMinuteOffset: 380 }],
    downtimeBlocks: [],
  };
}

describe("Dragline Delay Report persisted-total reads", () => {
  it("recalculates August 27 Draft history totals while ignoring persisted Code 13 downtime", async () => {
    mocks.findMany.mockResolvedValue([persistedReport("DRAFT")]);

    const reports = await getDraglineDelayReports();

    expect(reports[0]).toMatchObject({
      id: "draft-report",
      status: "DRAFT",
      downTimeMinutes: 30,
      runTimeMinutes: 690,
    });
    expect(reports[0]).not.toHaveProperty("timelineEntries");
    expect(reports[0]).not.toHaveProperty("groundChecks");
  });

  it("recalculates August 27 Completed detail totals while ignoring persisted Code 13 downtime", async () => {
    const persisted = persistedReport("COMPLETED");
    mocks.findUnique.mockResolvedValue(persisted);

    const report = await getDraglineDelayReportById("completed-report");

    expect(report).toMatchObject({
      id: "completed-report",
      status: "COMPLETED",
      downTimeMinutes: 30,
      runTimeMinutes: 690,
      timelineEntries: persisted.timelineEntries,
      groundChecks: persisted.groundChecks,
    });
  });

  it("loads existing reports without blocks and unions persisted Shared Downtime Blocks when present", async () => {
    const existing = persistedReport("DRAFT");
    const withBlock = {
      ...persistedReport("COMPLETED"),
      id: "report-with-block",
      timelineEntries: [persistedReport("COMPLETED").timelineEntries[1]],
      groundChecks: [{ startMinuteOffset: 380 }],
      downtimeBlocks: [{ startMinuteOffset: 310, durationMinutes: 400 }],
    };
    mocks.findMany.mockResolvedValue([existing, withBlock]);

    const reports = await getDraglineDelayReports();

    expect(reports[0]).toMatchObject({
      id: "draft-report",
      downTimeMinutes: 30,
    });
    expect(reports[1]).toMatchObject({
      id: "report-with-block",
      downTimeMinutes: 400,
      runTimeMinutes: 320,
    });
    expect(reports[0]).not.toHaveProperty("downtimeBlocks");
  });

  it("maps persisted Shared Downtime Blocks and ordered child notes into correction form state", () => {
    const initial = draglineDelayReportToFormInitial({
      operationalWorkDate: new Date("2026-09-03T00:00:00.000Z"),
      shift: "DAY",
      equipmentId: "equipment-1",
      startingHourMeter: 100,
      endingHourMeter: 110,
      supervisorId: "supervisor-1",
      lakeId: null,
      normalDiggingBuckets: null,
      benchfillBuckets: null,
      stationStartFeet: null,
      stationEndFeet: null,
      depthFeet: null,
      fuelGallons: null,
      cableDragFeet: null,
      hoistFeet: null,
      comments: null,
      safetyItemsFound: null,
      actionTaken: null,
      recordVersion: 4,
      operators: [],
      timelineEntries: [],
      groundChecks: [],
      downtimeBlocks: [
        {
          id: "block-1",
          startMinuteOffset: 310,
          durationMinutes: 400,
          description: "Scheduled PM",
          activities: [
            {
              id: "activity-1",
              delayCode: "35",
              description: "Startup inspection",
            },
            {
              id: "activity-2",
              delayCode: "36",
              description: "Routine service",
            },
          ],
        },
      ],
    } as never);

    expect(initial.downtimeBlocks).toEqual([
      expect.objectContaining({
        clientId: "block-1",
        id: "block-1",
        startTime: "05:10",
        dayOffset: 0,
        durationMinutes: "400",
        description: "Scheduled PM",
        activities: [
          expect.objectContaining({
            id: "activity-1",
            delayCode: "35",
            description: "Startup inspection",
          }),
          expect.objectContaining({
            id: "activity-2",
            delayCode: "36",
            description: "Routine service",
          }),
        ],
      }),
    ]);
  });
});
