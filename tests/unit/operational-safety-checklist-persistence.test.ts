import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = {
  equipment: { findUnique: vi.fn() },
  operationalSafetyChecklist: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  operationalSafetyChecklistResponse: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  },
}));

import {
  equipmentSnapshot,
  persistOperationalSafetyChecklist,
  preservedEquipmentSnapshot,
  responseSnapshot,
} from "@/features/operational-safety-checklists/persistence";
import { getSafetyChecklistTemplate } from "@/features/operational-safety-checklists/templates";
import { safetyChecklistSubmissionSchema } from "@/features/operational-safety-checklists/validation";

const equipment = {
  id: "equipment-1",
  displayName: "Current Dragline",
  equipmentNumber: "DL-1",
  category: "DRAGLINE" as const,
  status: "ACTIVE" as const,
  mine: { name: "Current Mine", city: { name: "Current City", state: "WY" } },
};

function input(
  equipmentId = "equipment-1",
  templateKey: "DRAGLINE_INSPECTION" | "MOBILE_INSPECTION" = "DRAGLINE_INSPECTION",
  meterKind: "HOURS" | "MILES" = templateKey === "MOBILE_INSPECTION" ? "MILES" : "HOURS",
  meterMismatchConfirmed = false,
) {
  const template = getSafetyChecklistTemplate(templateKey, 1)!;
  return safetyChecklistSubmissionSchema.parse({
    inspectionDate: "2026-07-15",
    shift: "DAY" as const,
    equipmentId,
    templateKey,
    templateVersion: 1,
    meterKind,
    startingMeter: "123",
    meterMismatchConfirmed,
    operatorDisplayName: "Alex Operator",
    supervisorDisplayName: "Sam Supervisor",
    problemDescription: "",
    responses: template.fields.map((field) => ({
      itemKey: field.key,
      responseCode:
        field.responseSet === "YES_NO"
          ? "YES"
          : field.responseSet === "PRESENCE_THREE"
            ? "PRESENT"
            : "OK",
    })),
  });
}

function existing() {
  const template = getSafetyChecklistTemplate("DRAGLINE_INSPECTION", 1)!;
  return {
    id: "checklist-1",
    inspectionDate: new Date("2026-07-15T00:00:00.000Z"),
    shift: "DAY",
    equipmentId: "equipment-1",
    equipmentDisplayName: "Historic Dragline",
    equipmentNumber: "OLD-1",
    equipmentCategory: "DRAGLINE" as const,
    mineName: "Historic Mine",
    cityName: "Historic City",
    cityState: "MT",
    templateKey: "DRAGLINE_INSPECTION" as const,
    templateVersion: 1,
    templateName: "Dragline Inspection",
    meterKind: "HOURS" as const,
    startingMeter: 100,
    operatorDisplayName: "Alex Operator",
    supervisorDisplayName: "Sam Supervisor",
    problemDescription: null,
    recordVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    responses: template.fields.map((field, index) => ({
      id: `response-${index}`,
      operationalSafetyChecklistId: "checklist-1",
      ...responseSnapshot(field, field.responseSet === "YES_NO" ? "YES" : "OK"),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  transaction.equipment.findUnique.mockResolvedValue(equipment);
  transaction.operationalSafetyChecklist.create.mockResolvedValue({ id: "checklist-1", recordVersion: 1 });
  transaction.operationalSafetyChecklist.update.mockResolvedValue({ id: "checklist-1", recordVersion: 2 });
  transaction.operationalSafetyChecklistResponse.deleteMany.mockResolvedValue({ count: 0 });
  transaction.operationalSafetyChecklistResponse.createMany.mockResolvedValue({ count: 24 });
  transaction.operationalSafetyChecklistResponse.upsert.mockResolvedValue({});
});

describe("Operational Safety Checklist persistence", () => {
  it("derives only approved Equipment snapshots server-side", () => {
    expect(equipmentSnapshot(equipment)).toEqual({
      equipmentDisplayName: "Current Dragline",
      equipmentNumber: "DL-1",
      equipmentCategory: "DRAGLINE",
      mineName: "Current Mine",
      cityName: "Current City",
      cityState: "WY",
    });
  });

  it("preserves historical Equipment snapshots independently of live reference changes", () => {
    expect(preservedEquipmentSnapshot(existing())).toMatchObject({
      equipmentDisplayName: "Historic Dragline",
      mineName: "Historic Mine",
      cityName: "Historic City",
    });
  });

  it("creates the parent and all canonical response snapshots in one transaction", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    await persistOperationalSafetyChecklist(input());
    expect(transaction.operationalSafetyChecklist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          equipmentDisplayName: "Current Dragline",
          meterKind: "HOURS",
          responses: { create: expect.arrayContaining([expect.objectContaining({ itemKey: "bench_condition", itemLabel: "Bench Condition" })]) },
        }),
        select: { id: true, recordVersion: true },
      }),
    );
  });

  it("increments the persisted record version atomically during correction", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(existing());
    await expect(
      persistOperationalSafetyChecklist(input(), "checklist-1"),
    ).resolves.toEqual({ id: "checklist-1", recordVersion: 2 });
    expect(transaction.operationalSafetyChecklist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recordVersion: { increment: 1 } }),
        select: { id: true, recordVersion: true },
      }),
    );
  });

  it("persists an explicitly confirmed Dragline Miles mismatch", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    await persistOperationalSafetyChecklist(
      input("equipment-1", "DRAGLINE_INSPECTION", "MILES", true),
    );
    expect(transaction.operationalSafetyChecklist.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ meterKind: "MILES" }) }),
    );
  });

  it("rejects a crafted unconfirmed known-category mismatch", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    await expect(
      persistOperationalSafetyChecklist(
        input("equipment-1", "DRAGLINE_INSPECTION", "MILES", false),
      ),
    ).rejects.toEqual(
      expect.objectContaining({ field: "meterKind", message: expect.stringContaining("Draglines normally use Hours") }),
    );
    expect(transaction.operationalSafetyChecklist.create).not.toHaveBeenCalled();
  });

  it("enforces the Work Truck Hours mismatch server-side", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    transaction.equipment.findUnique.mockResolvedValue({
      ...equipment,
      id: "truck-1",
      category: "WORK_TRUCK",
    });
    await expect(
      persistOperationalSafetyChecklist(
        input("truck-1", "MOBILE_INSPECTION", "HOURS", false),
      ),
    ).rejects.toEqual(
      expect.objectContaining({ field: "meterKind", message: expect.stringContaining("Work trucks normally use Miles") }),
    );
  });

  it.each(["HOURS", "MILES"] as const)(
    "allows Tractor %s without a known-category confirmation",
    async (meterKind) => {
      transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
      transaction.equipment.findUnique.mockResolvedValue({
        ...equipment,
        id: "tractor-1",
        category: "TRACTOR",
      });
      await expect(
        persistOperationalSafetyChecklist(
          input("tractor-1", "MOBILE_INSPECTION", meterKind, false),
        ),
      ).resolves.toMatchObject({ id: "checklist-1" });
    },
  );

  it("preserves an unchanged historical mismatch without reconfirmation", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue({
      ...existing(),
      meterKind: "MILES",
    });
    await expect(
      persistOperationalSafetyChecklist(
        input("equipment-1", "DRAGLINE_INSPECTION", "MILES", false),
        "checklist-1",
      ),
    ).resolves.toMatchObject({ id: "checklist-1" });
  });

  it("requires reconfirmation after changing an existing mismatch", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(existing());
    await expect(
      persistOperationalSafetyChecklist(
        input("equipment-1", "DRAGLINE_INSPECTION", "MILES", false),
        "checklist-1",
      ),
    ).rejects.toEqual(expect.objectContaining({ field: "meterKind" }));
  });

  it("preserves unchanged historical snapshots while updating response values", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(existing());
    await persistOperationalSafetyChecklist(input(), "checklist-1");
    expect(transaction.operationalSafetyChecklist.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ equipmentDisplayName: "Historic Dragline", mineName: "Historic Mine" }) }),
    );
    expect(transaction.operationalSafetyChecklistResponse.upsert).toHaveBeenCalledTimes(24);
    expect(transaction.operationalSafetyChecklistResponse.createMany).not.toHaveBeenCalled();
  });

  it("refreshes Equipment snapshots only after an intentional Equipment change", async () => {
    const historic = existing();
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(historic);
    transaction.equipment.findUnique.mockResolvedValue({ ...equipment, id: "equipment-2", displayName: "Replacement Dragline" });
    await persistOperationalSafetyChecklist(input("equipment-2"), "checklist-1");
    expect(transaction.operationalSafetyChecklist.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ equipmentDisplayName: "Replacement Dragline", mineName: "Current Mine" }) }),
    );
  });

  it("rejects inactive Equipment for a new checklist", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    transaction.equipment.findUnique.mockResolvedValue({
      ...equipment,
      status: "INACTIVE",
    });

    await expect(persistOperationalSafetyChecklist(input())).rejects.toEqual(
      expect.objectContaining({
        message: "Select active Equipment for this checklist.",
        field: "equipmentId",
      }),
    );
  });

  it("rejects Equipment outside the approved template categories", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(undefined);
    transaction.equipment.findUnique.mockResolvedValue({
      ...equipment,
      category: "OTHER",
    });

    await expect(persistOperationalSafetyChecklist(input())).rejects.toEqual(
      expect.objectContaining({
        message: "The selected Equipment is not eligible for an approved checklist template.",
        field: "equipmentId",
      }),
    );
  });

  it("replaces stale responses after an intentional template-family change", async () => {
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(existing());
    transaction.equipment.findUnique.mockResolvedValue({
      ...equipment,
      id: "truck-2",
      category: "WORK_TRUCK",
      displayName: "Replacement Truck",
    });

    await persistOperationalSafetyChecklist(
      input("truck-2", "MOBILE_INSPECTION"),
      "checklist-1",
    );

    expect(transaction.operationalSafetyChecklistResponse.deleteMany).toHaveBeenCalledWith({
      where: { operationalSafetyChecklistId: "checklist-1" },
    });
    expect(transaction.operationalSafetyChecklistResponse.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ itemKey: "rental_status", itemSection: "METADATA" }),
          expect.objectContaining({ itemKey: "fuel_card" }),
        ]),
      }),
    );
    expect(transaction.operationalSafetyChecklistResponse.upsert).not.toHaveBeenCalled();
  });

  it("treats SetNull history replacement as an Equipment identity change", async () => {
    const historical = { ...existing(), equipmentId: null };
    transaction.operationalSafetyChecklist.findUnique.mockResolvedValue(historical);
    transaction.equipment.findUnique.mockResolvedValue({
      ...equipment,
      id: "equipment-2",
      displayName: "Replacement Dragline",
    });

    await persistOperationalSafetyChecklist(input("equipment-2"), "checklist-1");

    expect(transaction.operationalSafetyChecklist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          equipmentId: "equipment-2",
          equipmentDisplayName: "Replacement Dragline",
          mineName: "Current Mine",
        }),
      }),
    );
  });
});
