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
});
