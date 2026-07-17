import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    operationalSafetyChecklist: { findMany: mocks.findMany },
  },
}));

import { getOperationalSafetyChecklistDayViewItems } from "@/features/operational-safety-checklists/data";

function checklist(overrides: Record<string, unknown> = {}) {
  return {
    id: "checklist-1",
    equipmentDisplayName: "Historic Dragline",
    equipmentNumber: "133",
    templateName: "Dragline Inspection",
    templateVersion: 1,
    shift: "DAY",
    startingMeter: 12_345,
    meterKind: "HOURS",
    responses: [
      { responseCode: "NEEDS_REPAIR" },
      { responseCode: "PREVIOUSLY_NOTED" },
      { responseCode: "PREVIOUSLY_NOTED" },
    ],
    ...overrides,
  };
}

describe("Operational Safety Checklist Day View query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("returns no records for an invalid operational date", async () => {
    await expect(
      getOperationalSafetyChecklistDayViewItems("2026-02-31"),
    ).resolves.toEqual([]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("filters by exact shift-start date before a deterministic bound", async () => {
    await getOperationalSafetyChecklistDayViewItems("2026-07-16");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { inspectionDate: new Date("2026-07-16T00:00:00.000Z") },
      select: {
        id: true,
        equipmentDisplayName: true,
        equipmentNumber: true,
        templateName: true,
        templateVersion: true,
        shift: true,
        startingMeter: true,
        meterKind: true,
        responses: {
          where: {
            responseCode: { in: ["NEEDS_REPAIR", "PREVIOUSLY_NOTED"] },
          },
          select: { responseCode: true },
        },
      },
      orderBy: [
        { shift: "asc" },
        { equipmentDisplayName: "asc" },
        { equipmentNumber: "asc" },
        { id: "asc" },
      ],
      take: 100,
    });
  });

  it("maps Dragline and Mobile records from historical snapshots", async () => {
    mocks.findMany.mockResolvedValue([
      checklist(),
      checklist({
        id: "checklist-2",
        equipmentDisplayName: "Historic Work Truck",
        equipmentNumber: "WT-8",
        templateName: "Mobile Inspection",
        meterKind: "MILES",
        startingMeter: 88_001,
        responses: [],
      }),
      checklist({
        id: "checklist-3",
        equipmentDisplayName: "Historic Tractor",
        equipmentNumber: null,
        templateName: "Mobile Inspection",
        shift: "NIGHT",
        responses: [{ responseCode: "NEEDS_REPAIR" }],
      }),
    ]);

    await expect(
      getOperationalSafetyChecklistDayViewItems("2026-07-16"),
    ).resolves.toEqual([
      expect.objectContaining({
        equipmentIdentity: "Historic Dragline #133",
        meter: "12,345 Hours",
        needsRepairCount: 1,
        previouslyNotedCount: 2,
        detailHref: "/operational-safety-checklists/checklist-1",
      }),
      expect.objectContaining({
        equipmentIdentity: "Historic Work Truck #WT-8",
        meter: "88,001 Miles",
        needsRepairCount: 0,
        previouslyNotedCount: 0,
      }),
      expect.objectContaining({
        equipmentIdentity: "Historic Tractor",
        shift: "Night",
        templateIdentity: "Mobile Inspection V1",
      }),
    ]);
  });

  it("returns an empty contribution for a date without checklists", async () => {
    await expect(
      getOperationalSafetyChecklistDayViewItems("2026-07-17"),
    ).resolves.toEqual([]);
  });
});
