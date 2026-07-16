import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getChecklist: vi.fn() }));

vi.mock("@/features/operational-safety-checklists/data", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/operational-safety-checklists/data")
  >("@/features/operational-safety-checklists/data");
  return { ...actual, getOperationalSafetyChecklistById: mocks.getChecklist };
});

import OperationalSafetyChecklistDetailPage from "@/app/operational-safety-checklists/[id]/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Operational Safety Checklist detail", () => {
  it("renders deleted Equipment history from snapshots", async () => {
    mocks.getChecklist.mockResolvedValue({
      id: "checklist-1",
      inspectionDate: new Date("2026-07-15T00:00:00.000Z"),
      shift: "DAY",
      equipmentId: null,
      equipmentDisplayName: "Deleted Dragline",
      equipmentNumber: "DL-OLD",
      equipmentCategory: "DRAGLINE",
      mineName: "Historic Mine",
      cityName: "Historic City",
      cityState: "MT",
      templateKey: "DRAGLINE_INSPECTION",
      templateVersion: 1,
      templateName: "Dragline Inspection",
      meterKind: "HOURS",
      startingMeter: 12345,
      operatorDisplayName: "Alex Operator",
      supervisorDisplayName: "Sam Supervisor",
      problemDescription: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      responses: [
        {
          id: "response-1",
          operationalSafetyChecklistId: "checklist-1",
          itemKey: "bench_condition",
          itemLabel: "Bench Condition",
          itemOrder: 6,
          itemSection: "INSPECTION",
          requiredMarker: null,
          responseSet: "CONDITION_FOUR",
          responseCode: "OK",
          responseLabel: "OK",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    render(
      await OperationalSafetyChecklistDetailPage({
        params: Promise.resolve({ id: "checklist-1" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Deleted Dragline" })).toBeInTheDocument();
    expect(screen.getByText("DL-OLD")).toBeInTheDocument();
    expect(screen.getByText("Historic Mine · Historic City, MT")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("Bench Condition")).toBeInTheDocument();
  });
});
