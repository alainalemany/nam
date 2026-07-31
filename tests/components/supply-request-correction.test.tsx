import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SupplyRequestCorrectionActionState,
  SupplyRequestCorrectionContext,
} from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({
  actionState: undefined as SupplyRequestCorrectionActionState | undefined,
  context: vi.fn(),
  immutable: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      mocks.actionState ?? initialState,
      vi.fn(),
      false,
    ]),
    useTransition: vi.fn(() => [false, (callback: () => void) => callback()]),
  };
});
vi.mock("@/features/supply-requests/correction-actions", () => ({
  correctSupplyRequestAction: vi.fn(),
}));
vi.mock("@/features/supply-requests/surface-actions", () => ({
  searchSupplyRequestEquipmentAction: vi.fn(async () => ({ options: [], error: null })),
  searchSupplyRequestSupervisorsAction: vi.fn(async () => ({ options: [], error: null })),
  searchSupplyRequestItemsAction: vi.fn(async () => ({ options: [], error: null })),
}));
vi.mock("@/features/supply-requests/surface-data", () => ({
  getSupplyRequestCorrectionContext: mocks.context,
  getImmutableSupplyRequestVersion: mocks.immutable,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import CorrectSupplyRequestPage from "@/app/supply-requests/[id]/correct/page";
import SupplyRequestVersionPage from "@/app/supply-requests/[id]/history/[version]/page";
import { SupplyRequestCorrectionForm } from "@/features/supply-requests/SupplyRequestCorrectionForm";
import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";

const detail: SupplyRequestCorrectionContext["detail"] = {
  supplyRequestId: "request-1",
  namReference: "SR-2026-0001",
  versionId: "version-2",
  versionNumber: 2,
  changeKind: "FULFILLED",
  status: "FULFILLED",
  operationalWorkDate: "2026-07-28",
  submittedLocalDate: "2026-07-29",
  submittedLocalTime: "01:15",
  equipmentId: "equipment-1",
  equipmentAvailable: true,
  equipmentLabel: "Dragline · 101",
  equipmentDisplayName: "Dragline",
  equipmentNumber: "101",
  equipmentCategory: "DRAGLINE",
  mineName: "Mine A",
  cityName: "Wright",
  cityState: "WY",
  requesterDisplayName: "Alain Alemany",
  requesterEmployeeNumber: "911601",
  supervisorId: "supervisor-1",
  supervisorName: "Supervisor One",
  supervisorEmail: "one@example.com",
  notes: "Notes",
  items: [
    {
      id: "line-1",
      supplyItemId: "item-1",
      sequence: 1,
      itemNumber: "A-1",
      description: "Filter",
      quantity: 2,
      unit: "Each",
    },
  ],
  createdAtLabel: "Jul 29, 2026",
  fulfillmentOperationalWorkDate: "2026-07-28",
  fulfilledLocalDate: "2026-07-29",
  fulfilledLocalTime: "02:00",
  fulfillmentNote: null,
  cancellationLocalDate: null,
  cancellationLocalTime: null,
  cancellationReason: null,
  correctionReason: null,
  correctedByDisplayName: null,
  correctionLocalDate: null,
  correctionLocalTime: null,
};
const context: SupplyRequestCorrectionContext = {
  detail,
  equipment: [
    {
      id: "equipment-1",
      label: "Dragline · 101",
      displayName: "Dragline",
      equipmentNumber: "101",
      mineName: "Mine A",
      cityName: "Wright",
      cityState: "WY",
    },
  ],
  supervisors: [
    { id: "supervisor-1", fullName: "Supervisor One", email: "one@example.com" },
  ],
  items: [
    { id: "item-1", itemNumber: "A-1", description: "Filter", unit: "Each" },
  ],
  requiresEquipmentReplacement: false,
};
const initial: SupplyRequestCorrectionActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {
    expectedCurrentVersionNumber: "2",
    correctionReason: "",
    operationalWorkDate: "2026-07-28",
    submittedLocalDate: "2026-07-29",
    submittedLocalTime: "01:15",
    equipmentId: "equipment-1",
    supervisorId: "supervisor-1",
    notes: "Notes",
    resultingStatus: "FULFILLED",
    fulfillmentOperationalWorkDate: "2026-07-28",
    fulfilledLocalDate: "2026-07-29",
    fulfilledLocalTime: "02:00",
    fulfillmentNote: "",
    cancelledLocalDate: "",
    cancelledLocalTime: "",
    cancellationReason: "",
  },
  items: [{ supplyItemId: "item-1", quantity: 2 }],
};

afterEach(cleanup);

describe("Supply Request correction routes and components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionState = undefined;
    mocks.context.mockResolvedValue(context);
    mocks.immutable.mockResolvedValue({
      detail,
      role: "superseded",
      currentVersionNumber: 3,
    });
  });

  it("renders the complete correction form with read-only identity and required reason", () => {
    render(<SupplyRequestCorrectionForm context={context} initialState={initial} />);
    expect(screen.getByRole("heading", { name: "Correct Request" })).toBeInTheDocument();
    expect(screen.getAllByText("SR-2026-0001").length).toBeGreaterThan(0);
    expect(screen.getByText("Alain Alemany")).toBeInTheDocument();
    expect(screen.getByText("South Warehouse")).toBeInTheDocument();
    expect(screen.getByLabelText("Correction Reason")).toBeRequired();
    expect(screen.getByText(/1000 characters or fewer/i)).toHaveAttribute(
      "id",
      "correction-reason-help",
    );
    expect(screen.getByRole("button", { name: "Save Corrected Version" })).toBeInTheDocument();
    expect(screen.getByText(/does not contact or modify the corporate system/i)).toBeInTheDocument();
  });

  it("switches status-specific fields without retaining incompatible controls", () => {
    render(<SupplyRequestCorrectionForm context={context} initialState={initial} />);
    expect(screen.getByLabelText("Fulfilled local date")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Resulting status"), {
      target: { value: "CANCELLED" },
    });
    expect(screen.queryByLabelText("Fulfilled local date")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cancelled local date")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Resulting status"), {
      target: { value: "REQUESTED" },
    });
    expect(screen.queryByLabelText("Cancelled local date")).not.toBeInTheDocument();
  });

  it("shows missing Equipment replacement and preserves ordered item controls", () => {
    render(
      <SupplyRequestCorrectionForm
        context={{ ...context, equipment: [], requiresEquipmentReplacement: true }}
        initialState={{ ...initial, values: { ...initial.values, equipmentId: "" } }}
      />,
    );
    expect(screen.getByText(/Select an active replacement/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity for A-1")).toHaveValue(2);
    expect(screen.getByRole("button", { name: "Move A-1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove A-1" })).toBeInTheDocument();
  });

  it("adds, reorders, edits, and removes corrected item lines by item identity", () => {
    render(
      <SupplyRequestCorrectionForm
        context={{
          ...context,
          items: [
            ...context.items,
            {
              id: "item-2",
              itemNumber: "B-2",
              description: "Hose",
              unit: "Foot",
            },
          ],
        }}
        initialState={initial}
      />,
    );
    fireEvent.change(screen.getByLabelText("Supply Item"), {
      target: { value: "item-2" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected item" }));
    expect(screen.getByLabelText("Quantity for B-2")).toHaveValue(4);
    fireEvent.click(screen.getByRole("button", { name: "Move B-2 up" }));
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("B-2");
    expect(rows[2]).toHaveTextContent("A-1");
    fireEvent.change(screen.getByLabelText("Quantity for B-2"), {
      target: { value: "5" },
    });
    expect(screen.getByLabelText("Quantity for B-2")).toHaveValue(5);
    fireEvent.click(screen.getByRole("button", { name: "Remove A-1" }));
    expect(screen.queryByLabelText("Quantity for A-1")).not.toBeInTheDocument();
  });

  it("renders accessible aggregate and field errors with submitted values", () => {
    mocks.actionState = {
      ...initial,
      status: "error",
      message: "Reload the current request.",
      fieldErrors: { correctionReason: ["Correction Reason is required."] },
      values: { ...initial.values, correctionReason: "" },
    };
    render(<SupplyRequestCorrectionForm context={context} initialState={initial} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reload");
    expect(screen.getByLabelText("Correction Reason")).toHaveAttribute(
      "aria-describedby",
      "correction-reason-help correction-reason-error",
    );
  });

  it("renders current history summaries and immutable correction metadata", () => {
    render(
      <SupplyRequestDetail
        detail={{
          ...detail,
          versionNumber: 3,
          versionId: "version-3",
          changeKind: "CORRECTED",
          status: "REQUESTED",
          fulfillmentOperationalWorkDate: null,
          fulfilledLocalDate: null,
          fulfilledLocalTime: null,
          correctionReason: "Wrong status",
          correctedByDisplayName: "Alain Alemany",
          correctionLocalDate: "2026-07-30",
          correctionLocalTime: "03:00",
        }}
        history={[
          {
            versionNumber: 2,
            changeKind: "FULFILLED",
            status: "FULFILLED",
            changeLocalDate: "2026-07-29",
            changeLocalTime: "02:00",
            correctionReason: null,
          },
          {
            versionNumber: 1,
            changeKind: "CREATED",
            status: "REQUESTED",
            changeLocalDate: "2026-07-29",
            changeLocalTime: "01:15",
            correctionReason: null,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Correct Request" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View version 2" })).toBeInTheDocument();
    expect(screen.getByText("Wrong status")).toBeInTheDocument();
    expect(screen.queryByText(/reopen/i)).not.toBeInTheDocument();
  });

  it("renders superseded immutable detail and uses not-found safely", async () => {
    const page = await SupplyRequestVersionPage({
      params: Promise.resolve({ id: "request-1", version: "2" }),
    });
    render(page);
    expect(screen.getByText("Superseded Version")).toBeInTheDocument();
    expect(screen.getByText(/no longer authoritative/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Correct Request" })).not.toBeInTheDocument();
    cleanup();
    mocks.context.mockResolvedValue(null);
    await expect(
      CorrectSupplyRequestPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("not-found");
  });
});
