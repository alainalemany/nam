import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEquipmentOptions: vi.fn(),
  getCreateAnotherInitial: vi.fn(),
}));

vi.mock("@/features/operational-safety-checklists/actions", () => ({
  createOperationalSafetyChecklistAction: vi.fn(async () => ({
    status: "idle",
    message: "",
    fieldErrors: {},
  })),
}));

vi.mock("@/features/operational-safety-checklists/data", () => ({
  getSafetyChecklistEquipmentOptions: mocks.getEquipmentOptions,
  getSafetyChecklistCreateAnotherInitial: mocks.getCreateAnotherInitial,
}));

import NewOperationalSafetyChecklistPage from "@/app/operational-safety-checklists/new/page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEquipmentOptions.mockResolvedValue([]);
  mocks.getCreateAnotherInitial.mockResolvedValue({
    inspectionDate: "2026-07-15",
    shift: "NIGHT",
    equipmentId: "",
    templateKey: "",
    templateVersion: 1,
    meterKind: "",
    startingMeter: "",
    operatorDisplayName: "Alex Operator",
    supervisorDisplayName: "Sam Supervisor",
    problemDescription: "",
    responses: {},
  });
});

describe("Operational Safety Checklist Create Another route", () => {
  it("loads only validated safe context from the source checklist", async () => {
    render(
      await NewOperationalSafetyChecklistPage({
        searchParams: Promise.resolve({ from: "checklist-1" }),
      }),
    );
    expect(mocks.getCreateAnotherInitial).toHaveBeenCalledWith("checklist-1");
    expect(screen.getByLabelText("Inspection date")).toHaveValue("2026-07-15");
    expect(screen.getByLabelText("Shift")).toHaveValue("NIGHT");
    expect(screen.getByLabelText("Operator")).toHaveValue("Alex Operator");
    expect(screen.getByLabelText("Supervisor")).toHaveValue("Sam Supervisor");
    expect(screen.getByLabelText("Equipment")).toHaveValue("");
    expect(screen.getByLabelText("Starting Meter Reading")).toHaveValue(null);
    expect(screen.getByRole("radio", { name: "Hours" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Miles" })).not.toBeChecked();
  });

  it("ignores malformed or stale query-prefill input safely", async () => {
    render(
      await NewOperationalSafetyChecklistPage({
        searchParams: Promise.resolve({ from: "../invalid?result=created" }),
      }),
    );
    expect(mocks.getCreateAnotherInitial).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Equipment")).toHaveValue("");
    expect(screen.getByLabelText("Operator")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
