import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  persist: vi.fn(),
  complete: vi.fn(),
  correct: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/features/dragline-delay-reports/persistence", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/dragline-delay-reports/persistence")
  >("@/features/dragline-delay-reports/persistence");
  return {
    ...actual,
    persistDraglineDelayReport: mocks.persist,
    completeDraglineDelayReport: mocks.complete,
    correctDraglineDelayReport: mocks.correct,
  };
});

import {
  correctDraglineDelayReportAction,
  updateDraglineDelayReportAction,
} from "@/features/dragline-delay-reports/actions";
import { DraglineDelayReportPersistenceError } from "@/features/dragline-delay-reports/persistence";
import { emptyDraglineDelayReportActionState } from "@/features/dragline-delay-reports/validation";

function mutationFormData(
  intent: "draft" | "complete" | "correct",
  overrides: Record<string, unknown> = {},
) {
  const data = new FormData();
  data.set("intent", intent);
  data.set("payload", JSON.stringify({
    operationalWorkDate: "2026-08-18",
    shift: "DAY",
    equipmentId: "dragline-1",
    startingHourMeter: "12345",
    endingHourMeter: "12356",
    supervisorId: "supervisor-1",
    lakeId: "",
    normalDiggingBuckets: "",
    benchfillBuckets: "",
    stationStart: "",
    stationEnd: "",
    depthFeet: "",
    fuelGallons: "",
    cableDragFeet: "",
    hoistFeet: "",
    comments: "",
    safetyItemsFound: "",
    actionTaken: "",
    recordVersion: 2,
    operators: [{ sequence: 1, employeeId: "operator-1" }],
    timelineEntries: [{
      sequence: 1,
      startTime: "16:59",
      dayOffset: 0,
      catalogVersion: 1,
      delayCode: "13",
      description: "Shift Change",
      durationMinutes: "",
      causesDowntime: false,
    }],
    groundChecks: [],
    correctionReason: "Corrected Ending Hour Meter from signed shift paperwork.",
    ...overrides,
  }));
  return data;
}

describe("Dragline Delay Report lifecycle Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persist.mockResolvedValue({ id: "report-1", recordVersion: 3 });
    mocks.complete.mockResolvedValue({ id: "report-1", recordVersion: 3 });
    mocks.correct.mockResolvedValue({ id: "report-1", recordVersion: 3 });
  });

  it("keeps Save Draft independent from Code 13", async () => {
    const data = mutationFormData("draft", {
      endingHourMeter: "",
      supervisorId: "",
      timelineEntries: [],
    });
    await expect(
      updateDraglineDelayReportAction(
        "report-1",
        emptyDraglineDelayReportActionState,
        data,
      ),
    ).rejects.toThrow("redirect:/dragline-delay-reports/report-1?saved=updated");
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("saves Start-only Section progress but keeps completion paired", async () => {
    await expect(
      updateDraglineDelayReportAction(
        "report-1",
        emptyDraglineDelayReportActionState,
        mutationFormData("draft", {
          stationStart: "18+5",
          stationEnd: "",
        }),
      ),
    ).rejects.toThrow("redirect:/dragline-delay-reports/report-1?saved=updated");
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ stationStart: "18+5", stationEnd: undefined }),
      "report-1",
    );

    const completion = await updateDraglineDelayReportAction(
      "report-1",
      emptyDraglineDelayReportActionState,
      mutationFormData("complete", {
        stationStart: "18+5",
        stationEnd: "",
      }),
    );
    expect(completion.fieldErrors.stationEnd).toEqual([
      "Enter both Section Start and Section End, or leave both blank.",
    ]);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("validates and explicitly completes through completion persistence", async () => {
    await expect(
      updateDraglineDelayReportAction(
        "report-1",
        emptyDraglineDelayReportActionState,
        mutationFormData("complete"),
      ),
    ).rejects.toThrow("redirect:/dragline-delay-reports/report-1?saved=completed");
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ endingHourMeter: 12356, recordVersion: 2 }),
      "report-1",
    );
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("passes Shared Downtime Blocks and child descriptions through the Server Action", async () => {
    const downtimeBlocks = [
      {
        sequence: 2,
        startTime: "05:10",
        dayOffset: 0,
        durationMinutes: "400",
        description: "Scheduled PM",
        activities: [
          {
            sequence: 1,
            catalogVersion: 1,
            delayCode: "35",
            description: "Startup inspection and grease checks",
          },
          {
            sequence: 2,
            catalogVersion: 1,
            delayCode: "36",
            description: "Bucket greasing and routine service",
          },
        ],
      },
    ];
    await expect(
      updateDraglineDelayReportAction(
        "report-1",
        emptyDraglineDelayReportActionState,
        mutationFormData("draft", { downtimeBlocks }),
      ),
    ).rejects.toThrow("redirect:/dragline-delay-reports/report-1?saved=updated");

    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        downtimeBlocks: [
          expect.objectContaining({
            durationMinutes: 400,
            description: "Scheduled PM",
            activities: [
              expect.objectContaining({
                delayCode: "35",
                description: "Startup inspection and grease checks",
              }),
              expect.objectContaining({
                delayCode: "36",
                description: "Bucket greasing and routine service",
              }),
            ],
          }),
        ],
      }),
      "report-1",
    );
  });

  it("returns completion field errors without persistence", async () => {
    const result = await updateDraglineDelayReportAction(
      "report-1",
      emptyDraglineDelayReportActionState,
      mutationFormData("complete", {
        endingHourMeter: "",
        supervisorId: "",
        timelineEntries: [],
      }),
    );
    expect(result.message).toContain("Cannot complete report yet");
    expect(result.fieldErrors).toMatchObject({
      endingHourMeter: expect.any(Array),
      supervisorId: expect.any(Array),
      timelineEntries: expect.any(Array),
    });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("requires and persists the Correction Reason", async () => {
    const missing = await correctDraglineDelayReportAction(
      "report-1",
      emptyDraglineDelayReportActionState,
      mutationFormData("correct", { correctionReason: "   " }),
    );
    expect(missing.fieldErrors.correctionReason).toEqual([
      "Correction Reason is required.",
    ]);
    expect(mocks.correct).not.toHaveBeenCalled();

    await expect(
      correctDraglineDelayReportAction(
        "report-1",
        emptyDraglineDelayReportActionState,
        mutationFormData("correct"),
      ),
    ).rejects.toThrow("redirect:/dragline-delay-reports/report-1?saved=corrected");
    expect(mocks.correct).toHaveBeenCalledWith(
      expect.objectContaining({ recordVersion: 2 }),
      "report-1",
      "Corrected Ending Hour Meter from signed shift paperwork.",
    );
  });

  it("returns operation-specific stale completion and correction messages", async () => {
    mocks.complete.mockRejectedValueOnce(
      new DraglineDelayReportPersistenceError(
        "This report changed elsewhere; reload before completing.",
        "recordVersion",
        "stale",
      ),
    );
    const completion = await updateDraglineDelayReportAction(
      "report-1",
      emptyDraglineDelayReportActionState,
      mutationFormData("complete"),
    );
    expect(completion.message).toContain("reload before completing");

    mocks.correct.mockRejectedValueOnce(
      new DraglineDelayReportPersistenceError(
        "This report changed elsewhere; reload before saving the correction.",
        "recordVersion",
        "stale",
      ),
    );
    const correction = await correctDraglineDelayReportAction(
      "report-1",
      emptyDraglineDelayReportActionState,
      mutationFormData("correct"),
    );
    expect(correction.message).toContain("reload before saving the correction");
  });
});
