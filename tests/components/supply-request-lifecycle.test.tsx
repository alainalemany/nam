import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplyRequestLifecycleActionState } from "@/features/supply-requests/lifecycle-action-state";
import type {
  SupplyRequestDetailView,
  SupplyRequestLifecycleActionContext,
} from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({
  actionState: undefined as SupplyRequestLifecycleActionState | undefined,
  context: vi.fn(),
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
  };
});
vi.mock("@/features/supply-requests/lifecycle-actions", () => ({
  fulfillSupplyRequestAction: vi.fn(),
  cancelSupplyRequestAction: vi.fn(),
}));
vi.mock("@/features/supply-requests/surface-data", () => ({
  getSupplyRequestLifecycleActionContext: mocks.context,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import CancelSupplyRequestPage from "@/app/supply-requests/[id]/cancel/page";
import FulfillSupplyRequestPage from "@/app/supply-requests/[id]/fulfill/page";
import {
  SupplyRequestLifecycleForm,
  SupplyRequestLifecycleUnavailable,
} from "@/features/supply-requests/SupplyRequestLifecycleForm";
import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";

const context: SupplyRequestLifecycleActionContext = {
  supplyRequestId: "request-1",
  namReference: "SR-2026-0001",
  versionNumber: 1,
  status: "REQUESTED",
  operationalWorkDate: "2026-07-28",
  submittedLocalDate: "2026-07-29",
  submittedLocalTime: "01:15",
  equipmentLabel: "Dragline · 101",
  itemCount: 2,
};

function detail(
  overrides: Partial<SupplyRequestDetailView> = {},
): SupplyRequestDetailView {
  return {
    supplyRequestId: "request-1",
    namReference: "SR-2026-0001",
    versionId: "version-1",
    versionNumber: 1,
    changeKind: "CREATED",
    status: "REQUESTED",
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
    supervisorName: "Pablo Gonzalez",
    supervisorEmail: "p@example.com",
    notes: null,
    items: [
      {
        id: "line-1",
        sequence: 1,
        itemNumber: "A-1",
        description: "Filter",
        quantity: 2,
        unit: "Each",
      },
    ],
    createdAtLabel: "Jul 29, 2026, 1:15 AM EDT",
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    fulfillmentNote: null,
    cancellationLocalDate: null,
    cancellationLocalTime: null,
    cancellationReason: null,
    correctionReason: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("Supply Request lifecycle routes and components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionState = undefined;
    mocks.context.mockResolvedValue(context);
  });

  it("shows explicit Fulfill and Cancel controls only on Requested current detail", () => {
    render(<SupplyRequestDetail detail={detail()} />);
    expect(screen.getByRole("link", { name: "Fulfill" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1/fulfill",
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1/cancel",
    );
    expect(screen.queryByText(/reopen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/correct request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No Daily Work Log entry/i)).toBeInTheDocument();
  });

  it("renders the fulfillment form with authoritative context and guidance", () => {
    render(<SupplyRequestLifecycleForm context={context} mode="fulfill" />);
    expect(screen.getByRole("heading", { name: "Mark Fulfilled" })).toBeInTheDocument();
    expect(screen.getByText("SR-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByLabelText("Fulfillment operational work date")).toHaveValue(
      "2026-07-28",
    );
    expect(screen.getByLabelText("Fulfillment Note (optional)")).toHaveAttribute(
      "maxlength",
      "1000",
    );
    expect(screen.getByText(/Partial receipt must remain Requested/i)).toBeInTheDocument();
    expect(screen.getByText(/America\/New_York/i)).toBeInTheDocument();
  });

  it("renders cancellation as a NAM-only action without editable timestamps", () => {
    render(<SupplyRequestLifecycleForm context={context} mode="cancel" />);
    expect(
      screen.getByRole("heading", { name: "Mark Cancelled in NAM" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cancellation Reason (optional)")).toBeInTheDocument();
    expect(
      screen.getByText(/does not cancel, change, contact, or resubmit/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/cancelled local date/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark Cancelled in NAM" }),
    ).toBeInTheDocument();
  });

  it("conditionally connects accessible field errors and preserves submitted values", () => {
    mocks.actionState = {
      status: "error",
      message: "Reload the current request.",
      fieldErrors: {
        fulfillmentOperationalWorkDate: ["Date is too early."],
      },
      values: {
        expectedCurrentVersionNumber: "1",
        fulfillmentOperationalWorkDate: "2026-07-27",
        fulfillmentNote: "Keep this note",
        cancellationReason: "",
      },
    };
    render(<SupplyRequestLifecycleForm context={context} mode="fulfill" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reload");
    expect(screen.getByLabelText("Fulfillment operational work date")).toHaveValue(
      "2026-07-27",
    );
    expect(screen.getByLabelText("Fulfillment operational work date")).toHaveAttribute(
      "aria-describedby",
      "fulfillment-operational-work-date-error",
    );
    expect(screen.getByLabelText("Fulfillment Note (optional)")).toHaveValue(
      "Keep this note",
    );
    expect(
      screen.getByLabelText("Fulfillment Note (optional)"),
    ).toHaveAttribute("aria-describedby", "fulfillment-note-help");
    expect(screen.getByLabelText("Fulfillment Note (optional)")).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("renders complete Fulfilled facts read-only and removes lifecycle controls", () => {
    render(
      <SupplyRequestDetail
        detail={detail({
          versionId: "version-2",
          versionNumber: 2,
          changeKind: "FULFILLED",
          status: "FULFILLED",
          fulfillmentOperationalWorkDate: "2026-07-29",
          fulfilledLocalDate: "2026-07-29",
          fulfilledLocalTime: "02:20",
          fulfillmentNote: "Received completely",
        })}
      />,
    );
    expect(screen.getAllByText("Fulfilled").length).toBeGreaterThan(0);
    expect(screen.getByText("Received completely")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fulfill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View original version 1" })).toBeInTheDocument();
  });

  it("renders complete Cancelled facts and the corporate-system boundary", () => {
    render(
      <SupplyRequestDetail
        detail={detail({
          versionId: "version-2",
          versionNumber: 2,
          changeKind: "CANCELLED",
          status: "CANCELLED",
          cancellationLocalDate: "2026-07-29",
          cancellationLocalTime: "02:20",
          cancellationReason: "No longer needed",
        })}
      />,
    );
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.getByText("No longer needed")).toBeInTheDocument();
    expect(screen.getByText(/recorded in NAM only/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fulfill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("uses route not-found for unknown IDs and read-only blocked state for terminals", async () => {
    mocks.context.mockResolvedValue(null);
    await expect(
      FulfillSupplyRequestPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("not-found");

    mocks.context.mockResolvedValue({ ...context, status: "FULFILLED", versionNumber: 2 });
    const page = await CancelSupplyRequestPage({
      params: Promise.resolve({ id: "request-1" }),
    });
    render(page);
    expect(screen.getByRole("heading", { name: "Cancellation unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/Current status: Fulfilled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    cleanup();
    render(
      <SupplyRequestLifecycleUnavailable
        actionLabel="Fulfillment"
        context={{ ...context, status: "CANCELLED", versionNumber: 2 }}
      />,
    );
    expect(screen.getByText(/Terminal requests remain read-only/i)).toBeInTheDocument();
  });
});
