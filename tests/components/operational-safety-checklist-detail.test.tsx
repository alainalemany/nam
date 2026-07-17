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
import { createSafetyChecklistResultMarker } from "@/features/operational-safety-checklists/result-marker";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Operational Safety Checklist detail", () => {
  const updatedAt = new Date("2026-07-16T12:00:00.000Z");

  function checklist() {
    return {
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
      recordVersion: 1,
      createdAt: new Date("2026-07-15T12:00:00.000Z"),
      updatedAt,
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
    };
  }

  it("renders deleted Equipment history from snapshots", async () => {
    mocks.getChecklist.mockResolvedValue(checklist());

    render(
      await OperationalSafetyChecklistDetailPage({
        params: Promise.resolve({ id: "checklist-1" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Deleted Dragline" })).toBeInTheDocument();
    expect(screen.getByText("DL-OLD")).toBeInTheDocument();
    expect(screen.getByText("Historic Mine · Historic City, MT")).toBeInTheDocument();
    expect(screen.getByText("12345 Hours")).toBeInTheDocument();
    expect(screen.getByText("Bench Condition")).toBeInTheDocument();
  });

  it.each([
    ["created", "Checklist saved in NAM Dashboard."],
    ["corrected", "Checklist correction saved in NAM Dashboard."],
  ] as const)("server-renders a verified %s result", async (outcome, message) => {
    process.env.NAM_CHECKLIST_RESULT_SIGNING_SECRET =
      "test-result-signing-secret-at-least-32-bytes";
    mocks.getChecklist.mockResolvedValue(checklist());
    const marker = createSafetyChecklistResultMarker(
      outcome,
      "checklist-1",
      1,
    );
    render(
      await OperationalSafetyChecklistDetailPage({
        params: Promise.resolve({ id: "checklist-1" }),
        searchParams: Promise.resolve({ result: marker }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });

  it("renders no success state for a manually constructed query value", async () => {
    mocks.getChecklist.mockResolvedValue(checklist());
    render(
      await OperationalSafetyChecklistDetailPage({
        params: Promise.resolve({ id: "checklist-1" }),
        searchParams: Promise.resolve({ result: "created" }),
      }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
