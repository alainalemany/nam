import { describe, expect, it } from "vitest";

import {
  workAuthorizationStatusValues,
  workAuthorizationWorkTypeValues,
} from "@/features/work-authorizations/constants";
import { workAuthorizationFormSchema } from "@/features/work-authorizations/validation";

const validInput = {
  shiftReportId: "shift-report-1",
  status: "OPEN",
  workType: "MAINTENANCE",
  mineId: "",
  equipmentId: "",
  jobLocation: "",
  workDescription: "Repair dragline access ladder.",
  startTime: "",
  endTime: "",
  crewWorkerCount: "",
  contactName: "",
  equipmentRequired: "",
  personInChargeName: "",
  lockoutRequired: "on",
  lockoutNotRequiredReason: "",
  workplaceExamRequired: "",
  confinedSpaceRequired: "",
  lockoutTagoutRequired: "on",
  hotWorkRequired: "",
  workingAtHeightsRequired: "",
  stopCardJhaRequired: "",
  jobCompleted: "",
  permitsClosed: "",
  guardsReplaced: "",
  lockoutTagoutRemoved: "",
  toolsRemoved: "",
  housekeepingCompleted: "",
  supervisorNotified: "",
  completionNotes: "",
};

describe("workAuthorizationFormSchema", () => {
  it("accepts a minimal valid Work Authorization", () => {
    const parsed = workAuthorizationFormSchema.safeParse(validInput);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      shiftReportId: "shift-report-1",
      status: "OPEN",
      workType: "MAINTENANCE",
      lockoutRequired: true,
      lockoutTagoutRequired: true,
      workDescription: "Repair dragline access ladder.",
    });
  });

  it("normalizes optional fields and coerces crew count", () => {
    const parsed = workAuthorizationFormSchema.safeParse({
      ...validInput,
      mineId: "  ",
      equipmentId: "",
      jobLocation: "  North pad  ",
      workDescription: "  Replace guard.  ",
      crewWorkerCount: " 3 ",
      contactName: "  Alex  ",
      equipmentRequired: "  Manlift  ",
      personInChargeName: "  Jordan  ",
      completionNotes: "  Completed during day shift.  ",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      mineId: undefined,
      equipmentId: undefined,
      jobLocation: "North pad",
      workDescription: "Replace guard.",
      crewWorkerCount: 3,
      contactName: "Alex",
      equipmentRequired: "Manlift",
      personInChargeName: "Jordan",
      completionNotes: "Completed during day shift.",
    });
  });

  it("requires a lockout reason when lockout is not required", () => {
    const parsed = workAuthorizationFormSchema.safeParse({
      ...validInput,
      lockoutRequired: "",
      lockoutTagoutRequired: "",
      lockoutNotRequiredReason: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.lockoutNotRequiredReason).toContain(
      "Explain why lockout is not required.",
    );
  });

  it("requires completion checklist items before closing", () => {
    const parsed = workAuthorizationFormSchema.safeParse({
      ...validInput,
      status: "CLOSED",
      jobCompleted: "on",
      permitsClosed: "",
      guardsReplaced: "",
      lockoutTagoutRemoved: "",
      toolsRemoved: "",
      housekeepingCompleted: "",
      supervisorNotified: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.permitsClosed).toContain(
      "Complete all checklist items before closing.",
    );
    expect(parsed.error?.flatten().fieldErrors.supervisorNotified).toContain(
      "Complete all checklist items before closing.",
    );
  });

  it("uses feature-owned status and work type values", () => {
    expect(workAuthorizationStatusValues).toContain("CLOSED");
    expect(workAuthorizationWorkTypeValues).toContain("HOT_WORK");

    const parsed = workAuthorizationFormSchema.safeParse({
      ...validInput,
      status: "DONE",
      workType: "NOT_REAL",
    });

    expect(parsed.success).toBe(false);
  });
});
