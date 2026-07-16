import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSafetyChecklistTemplate } from "@/features/operational-safety-checklists/templates";

const mocks = vi.hoisted(() => ({ persist: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/features/operational-safety-checklists/persistence", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/operational-safety-checklists/persistence")
  >("@/features/operational-safety-checklists/persistence");
  return { ...actual, persistOperationalSafetyChecklist: mocks.persist };
});

import {
  correctOperationalSafetyChecklistAction,
  createOperationalSafetyChecklistAction,
} from "@/features/operational-safety-checklists/actions";
import { emptySafetyChecklistActionState } from "@/features/operational-safety-checklists/validation";

function formData() {
  const template = getSafetyChecklistTemplate("DRAGLINE_INSPECTION", 1)!;
  const data = new FormData();
  data.set("inspectionDate", "2026-07-15");
  data.set("shift", "DAY");
  data.set("equipmentId", "equipment-1");
  data.set("templateKey", template.key);
  data.set("templateVersion", String(template.version));
  data.set("startingMeter", "200");
  data.set("operatorDisplayName", "Alex Operator");
  data.set("supervisorDisplayName", "Sam Supervisor");
  data.set("problemDescription", "");
  for (const field of template.fields) {
    data.set(`response.${field.key}`, field.responseSet === "YES_NO" ? "YES" : "OK");
  }
  return data;
}

describe("Operational Safety Checklist Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persist.mockResolvedValue({ id: "checklist-1" });
  });

  it("submits one complete checklist through feature-owned persistence", async () => {
    await expect(
      createOperationalSafetyChecklistAction(emptySafetyChecklistActionState, formData()),
    ).rejects.toThrow("redirect:/operational-safety-checklists/checklist-1");
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        inspectionDate: "2026-07-15",
        startingMeter: 200,
        responses: expect.arrayContaining([
          { itemKey: "bench_condition", responseCode: "OK" },
        ]),
      }),
    );
  });

  it("uses the explicit correction path for an existing completed checklist", async () => {
    await expect(
      correctOperationalSafetyChecklistAction(
        "checklist-1",
        emptySafetyChecklistActionState,
        formData(),
      ),
    ).rejects.toThrow("redirect:/operational-safety-checklists/checklist-1");
    expect(mocks.persist).toHaveBeenCalledWith(expect.any(Object), "checklist-1");
  });

  it("returns item-specific validation without creating incomplete state", async () => {
    const data = formData();
    data.delete("response.bench_condition");
    const result = await createOperationalSafetyChecklistAction(
      emptySafetyChecklistActionState,
      data,
    );
    expect(result).toMatchObject({ status: "error" });
    expect(result.fieldErrors["responses.bench_condition"]).toBeDefined();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("returns a user-safe duplicate Equipment/date/shift conflict", async () => {
    mocks.persist.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await createOperationalSafetyChecklistAction(
      emptySafetyChecklistActionState,
      formData(),
    );
    expect(result.message).toBe(
      "A checklist already exists for this Equipment, date, and shift.",
    );
  });

  it("returns a safe uniqueness conflict during identity correction", async () => {
    mocks.persist.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const result = await correctOperationalSafetyChecklistAction(
      "checklist-1",
      emptySafetyChecklistActionState,
      formData(),
    );
    expect(result).toMatchObject({
      status: "error",
      message: "A checklist already exists for this Equipment, date, and shift.",
    });
  });

  it("rejects an incomplete response set during Equipment correction", async () => {
    const data = formData();
    data.delete("response.bench_condition");
    const result = await correctOperationalSafetyChecklistAction(
      "checklist-1",
      emptySafetyChecklistActionState,
      data,
    );
    expect(result.fieldErrors["responses.bench_condition"]).toBeDefined();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
});
