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
  draglineDelayReportToCompletionPayload,
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
    expect(initial.benchfillBuckets).toBe("");
  });

  it.each([
    [null, ""],
    [0, "0"],
    [27, "27"],
  ])("preserves an existing Benchfill Buckets value of %s", (value, expected) => {
    const initial = draglineDelayReportToFormInitial({
      operationalWorkDate: new Date("2026-09-03T00:00:00.000Z"),
      shift: "DAY",
      equipmentId: "equipment-1",
      startingHourMeter: 100,
      endingHourMeter: null,
      supervisorId: null,
      lakeId: null,
      normalDiggingBuckets: null,
      benchfillBuckets: value,
      stationStartFeet: null,
      stationEndFeet: null,
      depthFeet: null,
      fuelGallons: null,
      cableDragFeet: null,
      hoistFeet: null,
      comments: null,
      safetyItemsFound: null,
      actionTaken: null,
      recordVersion: 1,
      operators: [],
      timelineEntries: [],
      groundChecks: [],
      downtimeBlocks: [],
    } as never);

    expect(initial.benchfillBuckets).toBe(expected);
  });

  it("hydrates persisted mixed order and upgrades legacy per-type order in form state", () => {
    const baseReport = {
      operationalWorkDate: new Date("2026-09-03T00:00:00.000Z"),
      shift: "DAY",
      equipmentId: "equipment-1",
      startingHourMeter: 100,
      endingHourMeter: null,
      supervisorId: null,
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
      recordVersion: 1,
      operators: [],
      groundChecks: [],
    };
    const entry = (id: string, sequence: number, startMinuteOffset: number) => ({
      id,
      sequence,
      startMinuteOffset,
      delayCode: "26",
      description: id,
      durationMinutes: null,
      causesDowntime: false,
    });
    const block = (sequence: number, startMinuteOffset: number) => ({
      id: "block-1",
      sequence,
      startMinuteOffset,
      durationMinutes: 20,
      description: "block",
      activities: [],
    });

    const mixed = draglineDelayReportToFormInitial({
      ...baseReport,
      timelineEntries: [entry("row-1", 1, 323), entry("row-2", 3, 387)],
      downtimeBlocks: [block(2, 335)],
    } as never);
    expect(mixed.timelineEntries.map((item) => item.sequence)).toEqual([1, 3]);
    expect(mixed.downtimeBlocks[0].sequence).toBe(2);

    const legacy = draglineDelayReportToFormInitial({
      ...baseReport,
      timelineEntries: [entry("row-1", 1, 387)],
      downtimeBlocks: [block(1, 335)],
    } as never);
    expect(legacy.downtimeBlocks[0].sequence).toBe(1);
    expect(legacy.timelineEntries[0].sequence).toBe(2);
  });

  it("builds a complete persisted aggregate payload for detail-view completion", () => {
    const payload = draglineDelayReportToCompletionPayload({
      operationalWorkDate: new Date("2026-09-03T00:00:00.000Z"),
      shift: "DAY",
      equipmentId: "equipment-1",
      startingHourMeter: 100,
      endingHourMeter: 110,
      supervisorId: "supervisor-1",
      lakeId: null,
      normalDiggingBuckets: 12,
      benchfillBuckets: 0,
      stationStartFeet: 1600,
      stationEndFeet: 1620,
      depthFeet: null,
      fuelGallons: null,
      cableDragFeet: null,
      hoistFeet: null,
      comments: "Shift complete",
      safetyItemsFound: null,
      actionTaken: null,
      recordVersion: 4,
      operators: [{ id: "operator-row-1", employeeId: "employee-1" }],
      timelineEntries: [{
        id: "timeline-1",
        sequence: 2,
        startMinuteOffset: 1020,
        delayCode: "13",
        description: "Shift Change",
        durationMinutes: null,
        causesDowntime: false,
      }],
      groundChecks: [{ id: "ground-check-1", startMinuteOffset: 600 }],
      downtimeBlocks: [{
        id: "block-1",
        sequence: 1,
        startMinuteOffset: 310,
        durationMinutes: 30,
        description: "Maintenance",
        activities: [{
          id: "activity-1",
          delayCode: "35",
          description: "Startup inspection",
        }],
      }],
    } as never, 3);

    expect(payload).toMatchObject({
      operationalWorkDate: "2026-09-03",
      recordVersion: 3,
      benchfillBuckets: "0",
      operators: [{
        id: "operator-row-1",
        sequence: 1,
        employeeId: "employee-1",
      }],
      timelineEntries: [{
        id: "timeline-1",
        sequence: 2,
        startTime: "17:00",
        dayOffset: 0,
        catalogVersion: 1,
        delayCode: "13",
      }],
      downtimeBlocks: [{
        id: "block-1",
        sequence: 1,
        startTime: "05:10",
        durationMinutes: "30",
        activities: [{
          id: "activity-1",
          sequence: 1,
          catalogVersion: 1,
          delayCode: "35",
        }],
      }],
      groundChecks: [{
        id: "ground-check-1",
        sequence: 1,
        startTime: "10:00",
        dayOffset: 0,
      }],
    });
  });
});
