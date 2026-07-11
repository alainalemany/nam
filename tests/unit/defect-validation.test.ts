import { describe, expect, it } from "vitest";

import {
  canTransitionDefectStatus,
  defectLifecycleUpdate,
  defectPriorityValues,
  defectSeverityValues,
  defectStatusValues,
} from "@/features/defect-tracking/constants";
import { defectFormSchema } from "@/features/defect-tracking/validation";

const validInput = {
  reportedDate: "2026-07-11",
  equipmentId: "equipment-1",
  sourceDailyInspectionId: "",
  severity: "HIGH",
  priority: "URGENT",
  status: "OPEN",
  title: "Hoist alarm fault",
  description: "Intermittent alarm appeared during startup.",
  correctiveAction: "",
  resolutionSummary: "",
};

describe("defectFormSchema", () => {
  it("accepts a valid open defect and normalizes optional fields", () => {
    const parsed = defectFormSchema.safeParse({
      ...validInput,
      equipmentId: " equipment-1 ",
      title: " Hoist alarm fault ",
      correctiveAction: "  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      equipmentId: "equipment-1",
      sourceDailyInspectionId: undefined,
      title: "Hoist alarm fault",
      correctiveAction: undefined,
    });
  });

  it("requires equipment, title, and description", () => {
    const parsed = defectFormSchema.safeParse({
      ...validInput,
      equipmentId: " ",
      title: " ",
      description: " ",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.equipmentId).toContain("Equipment is required.");
    expect(parsed.error?.flatten().fieldErrors.title).toContain("Title is required.");
    expect(parsed.error?.flatten().fieldErrors.description).toContain("Description is required.");
  });

  it("requires a resolution summary for resolved and closed records", () => {
    for (const status of ["RESOLVED", "CLOSED"]) {
      const parsed = defectFormSchema.safeParse({ ...validInput, status });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.flatten().fieldErrors.resolutionSummary).toContain(
        "Resolution summary is required before resolving a defect.",
      );
    }
  });

  it("uses the approved status, severity, and priority values", () => {
    expect(defectStatusValues).toEqual(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
    expect(defectSeverityValues).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(defectPriorityValues).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    expect(defectFormSchema.safeParse({ ...validInput, severity: "URGENT" }).success).toBe(false);
    expect(defectFormSchema.safeParse({ ...validInput, priority: "CRITICAL" }).success).toBe(false);
  });
});

describe("Defect lifecycle", () => {
  it("allows only approved transitions and unchanged status", () => {
    expect(canTransitionDefectStatus("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransitionDefectStatus("IN_PROGRESS", "RESOLVED")).toBe(true);
    expect(canTransitionDefectStatus("RESOLVED", "CLOSED")).toBe(true);
    expect(canTransitionDefectStatus("RESOLVED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionDefectStatus("OPEN", "RESOLVED")).toBe(false);
    expect(canTransitionDefectStatus("CLOSED", "OPEN")).toBe(false);
    expect(canTransitionDefectStatus("CLOSED", "CLOSED")).toBe(true);
  });

  it("records resolution and closure timestamps", () => {
    const resolvedAt = new Date("2026-07-11T12:00:00.000Z");
    const resolved = defectLifecycleUpdate({
      currentStatus: "IN_PROGRESS",
      nextStatus: "RESOLVED",
      submittedResolutionSummary: "Replaced the faulty sensor.",
      currentResolutionSummary: null,
      currentResolvedAt: null,
      currentClosedAt: null,
      now: resolvedAt,
    });
    expect(resolved).toEqual({
      resolutionSummary: "Replaced the faulty sensor.",
      resolvedAt,
      closedAt: null,
    });

    const closedAt = new Date("2026-07-11T14:00:00.000Z");
    const closed = defectLifecycleUpdate({
      currentStatus: "RESOLVED",
      nextStatus: "CLOSED",
      submittedResolutionSummary: resolved.resolutionSummary ?? undefined,
      currentResolutionSummary: resolved.resolutionSummary,
      currentResolvedAt: resolved.resolvedAt,
      currentClosedAt: null,
      now: closedAt,
    });
    expect(closed.resolvedAt).toBe(resolvedAt);
    expect(closed.closedAt).toBe(closedAt);
  });

  it("preserves resolution data on reopen and refreshes it on re-resolution", () => {
    const firstResolvedAt = new Date("2026-07-11T12:00:00.000Z");
    const reopened = defectLifecycleUpdate({
      currentStatus: "RESOLVED",
      nextStatus: "IN_PROGRESS",
      submittedResolutionSummary: "Changed text",
      currentResolutionSummary: "First repair.",
      currentResolvedAt: firstResolvedAt,
      currentClosedAt: null,
      now: new Date("2026-07-11T13:00:00.000Z"),
    });
    expect(reopened.resolutionSummary).toBe("First repair.");
    expect(reopened.resolvedAt).toBe(firstResolvedAt);

    const secondResolvedAt = new Date("2026-07-12T12:00:00.000Z");
    const resolvedAgain = defectLifecycleUpdate({
      currentStatus: "IN_PROGRESS",
      nextStatus: "RESOLVED",
      submittedResolutionSummary: "Second repair held.",
      currentResolutionSummary: reopened.resolutionSummary,
      currentResolvedAt: reopened.resolvedAt,
      currentClosedAt: null,
      now: secondResolvedAt,
    });
    expect(resolvedAgain.resolutionSummary).toBe("Second repair held.");
    expect(resolvedAgain.resolvedAt).toBe(secondResolvedAt);
  });
});
