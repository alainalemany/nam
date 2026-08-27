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
    downTimeMinutes: 0,
    runTimeMinutes: 720,
    timelineEntries: [{
      startMinuteOffset: 600,
      durationMinutes: 30,
      causesDowntime: true,
    }],
    groundChecks: [
      { startMinuteOffset: 605 },
      { startMinuteOffset: 720 },
    ],
  };
}

describe("Dragline Delay Report persisted-total reads", () => {
  it("recalculates existing Draft history totals from persisted Ground Checks", async () => {
    mocks.findMany.mockResolvedValue([persistedReport("DRAFT")]);

    const reports = await getDraglineDelayReports();

    expect(reports[0]).toMatchObject({
      id: "draft-report",
      status: "DRAFT",
      downTimeMinutes: 40,
      runTimeMinutes: 680,
    });
    expect(reports[0]).not.toHaveProperty("timelineEntries");
    expect(reports[0]).not.toHaveProperty("groundChecks");
  });

  it("recalculates existing Completed detail totals without rewriting its rows", async () => {
    const persisted = persistedReport("COMPLETED");
    mocks.findUnique.mockResolvedValue(persisted);

    const report = await getDraglineDelayReportById("completed-report");

    expect(report).toMatchObject({
      id: "completed-report",
      status: "COMPLETED",
      downTimeMinutes: 40,
      runTimeMinutes: 680,
      timelineEntries: persisted.timelineEntries,
      groundChecks: persisted.groundChecks,
    });
  });
});
