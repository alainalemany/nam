import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SupplyRequestCreateActionState,
  SupplyRequestCreatePageData,
  SupplyRequestDetailView,
} from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({
  actionState: undefined as SupplyRequestCreateActionState | undefined,
  createAction: vi.fn(),
  equipmentSearch: vi.fn(),
  supervisorSearch: vi.fn(),
  itemSearch: vi.fn(),
  currentDetail: vi.fn(),
  originalDetail: vi.fn(),
  pageData: vi.fn(),
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
    useTransition: vi.fn(() => [
      false,
      (callback: () => void | Promise<void>) => {
        void callback();
      },
    ]),
  };
});
vi.mock("@/features/supply-requests/surface-actions", () => ({
  createSupplyRequestAction: mocks.createAction,
  searchSupplyRequestEquipmentAction: mocks.equipmentSearch,
  searchSupplyRequestSupervisorsAction: mocks.supervisorSearch,
  searchSupplyRequestItemsAction: mocks.itemSearch,
}));
vi.mock("@/features/supply-requests/surface-data", () => ({
  getSupplyRequestCreatePageData: mocks.pageData,
  getCurrentSupplyRequestDetail: mocks.currentDetail,
  getOriginalSupplyRequestDetail: mocks.originalDetail,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import SupplyRequestDetailPage from "@/app/supply-requests/[id]/page";
import SupplyRequestOriginalVersionPage from "@/app/supply-requests/[id]/history/[version]/page";
import NewSupplyRequestPage from "@/app/supply-requests/new/page";
import { SupplyRequestCreateForm } from "@/features/supply-requests/SupplyRequestCreateForm";
import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";

const pageData: SupplyRequestCreatePageData = {
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
    { id: "supervisor-1", fullName: "Pablo Gonzalez", email: "p@example.com" },
  ],
  items: [
    {
      id: "item-1",
      itemNumber: "A-1",
      description: "Filter",
      unit: "Each",
    },
    {
      id: "item-2",
      itemNumber: "B-2",
      description: "Hose",
      unit: "Foot",
    },
  ],
  hasActiveEquipment: true,
  hasActiveSupervisors: true,
  hasActiveItems: true,
  loadError: null,
};

const initialState: SupplyRequestCreateActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {
    operationalWorkDate: "2026-07-29",
    submittedLocalDate: "2026-07-29",
    submittedLocalTime: "09:05",
    equipmentId: "",
    supervisorId: "",
    notes: "",
    corporateSubmissionConfirmed: false,
  },
  items: [],
};

const detail: SupplyRequestDetailView = {
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
};

afterEach(cleanup);

describe("Supply Request create and detail surfaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionState = undefined;
    mocks.pageData.mockResolvedValue(pageData);
    mocks.currentDetail.mockResolvedValue(detail);
    mocks.originalDetail.mockResolvedValue(detail);
    mocks.equipmentSearch.mockResolvedValue({ options: [], error: null });
    mocks.supervisorSearch.mockResolvedValue({ options: [], error: null });
    mocks.itemSearch.mockResolvedValue({ options: [], error: null });
  });

  it("renders read-only requester, warehouse, canonical defaults, and confirmation", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    expect(screen.getByText("Alain Alemany")).toBeInTheDocument();
    expect(screen.getByText("911601")).toBeInTheDocument();
    expect(screen.getByText("South Warehouse")).toBeInTheDocument();
    expect(screen.getByLabelText("Submitted local date")).toHaveValue(
      "2026-07-29",
    );
    expect(screen.getByLabelText("Submitted local time")).toHaveValue("09:05");
    expect(
      screen.getByLabelText(
        "I confirm that this request was successfully submitted through the corporate system.",
      ),
    ).toBeInTheDocument();
  });

  it("supports explicit item add, quantity edit, order controls, and removal", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Supply Item"), {
      target: { value: "item-1" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected item" }));
    expect(screen.getByLabelText("Quantity for A-1")).toHaveValue(3);
    expect(screen.getByText("Each")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Supply Item"), {
      target: { value: "item-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected item" }));
    fireEvent.click(screen.getByRole("button", { name: "Move B-2 up" }));
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("B-2")).toBeInTheDocument();
    fireEvent.click(
      within(rows[1]).getByRole("button", { name: "Remove B-2" }),
    );
    expect(screen.queryByText("B-2")).not.toBeInTheDocument();
  });

  it("prevents duplicate selection and identifies every row action accessibly", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Supply Item"), {
      target: { value: "item-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected item" }));
    fireEvent.change(screen.getByLabelText("Supply Item"), {
      target: { value: "item-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected item" }));
    expect(screen.getByRole("status")).toHaveTextContent("only once");
    expect(
      screen.getByRole("button", { name: "Move A-1 up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move A-1 down" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove A-1" }),
    ).toBeInTheDocument();
  });

  it("keeps the newest asynchronous Equipment search result", async () => {
    let resolveFirst:
      | ((value: {
          options: SupplyRequestCreatePageData["equipment"];
          error: null;
        }) => void)
      | undefined;
    let resolveSecond:
      | ((value: {
          options: SupplyRequestCreatePageData["equipment"];
          error: null;
        }) => void)
      | undefined;
    mocks.equipmentSearch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    const equipmentSection = screen
      .getByRole("heading", { name: "Equipment" })
      .closest("section");
    if (!equipmentSection) throw new Error("Equipment section missing.");
    const search = within(equipmentSection).getByLabelText("Search Equipment");
    const searchButton = within(equipmentSection).getByRole("button", {
      name: "Run Equipment search",
    });
    fireEvent.change(search, { target: { value: "old" } });
    fireEvent.click(searchButton);
    fireEvent.change(search, { target: { value: "new" } });
    fireEvent.click(searchButton);

    await act(async () => {
      resolveSecond?.({
        options: [
          {
            ...pageData.equipment[0],
            id: "equipment-new",
            label: "Newest Equipment",
          },
        ],
        error: null,
      });
      await Promise.resolve();
    });
    await act(async () => {
      resolveFirst?.({
        options: [
          {
            ...pageData.equipment[0],
            id: "equipment-old",
            label: "Stale Equipment",
          },
        ],
        error: null,
      });
      await Promise.resolve();
    });
    expect(
      within(equipmentSection).getByRole("option", {
        name: /Newest Equipment/,
      }),
    ).toBeInTheDocument();
    expect(
      within(equipmentSection).queryByRole("option", {
        name: /Stale Equipment/,
      }),
    ).toBeNull();
  });

  it("uses Enter in a search input for search rather than create submission", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    const search = screen.getByLabelText("Search Equipment");
    fireEvent.change(search, { target: { value: "dragline" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(mocks.equipmentSearch).toHaveBeenCalledWith("dragline");
    expect(mocks.createAction).not.toHaveBeenCalled();
  });

  it("keeps stale selected reference displays when a later search omits them", async () => {
    mocks.equipmentSearch.mockResolvedValue({ options: [], error: null });
    mocks.supervisorSearch.mockResolvedValue({ options: [], error: null });
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Active Equipment"), {
      target: { value: "equipment-1" },
    });
    fireEvent.change(screen.getByLabelText("Active Supervisor"), {
      target: { value: "supervisor-1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Run Equipment search" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Run Supervisors search" }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Active Equipment")).toHaveValue(
      "equipment-1",
    );
    expect(screen.getByText("Email: p@example.com")).toBeInTheDocument();
  });

  it("blocks create when required active catalogs are empty", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={{
          ...pageData,
          equipment: [],
          supervisors: [],
          items: [],
          hasActiveEquipment: false,
          hasActiveSupervisors: false,
          hasActiveItems: false,
        }}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    expect(screen.getByText("Active Equipment is required")).toBeInTheDocument();
    expect(screen.getByText("An active supervisor is required")).toBeInTheDocument();
    expect(
      screen.getByText("At least one active Supply Item is required"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record Supply Request/ })).toBeNull();
  });

  it("does not misreport missing catalogs when reference loading fails", () => {
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={{
          ...pageData,
          equipment: [],
          supervisors: [],
          items: [],
          hasActiveEquipment: false,
          hasActiveSupervisors: false,
          hasActiveItems: false,
          loadError: "References could not be loaded.",
        }}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    expect(screen.getByText("Reference data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Active Equipment is required")).toBeNull();
    expect(screen.queryByText("An active supervisor is required")).toBeNull();
  });

  it("renders safe field and aggregate errors with preserved values", () => {
    mocks.actionState = {
      ...initialState,
      status: "error",
      message: "The selected supervisor is inactive.",
      fieldErrors: { supervisorId: ["Choose an active supervisor."] },
      values: { ...initialState.values, notes: "Preserved narrative" },
      items: [{ supplyItemId: "item-1", quantity: 2 }],
    };
    render(
      <SupplyRequestCreateForm
        defaults={{ date: "2026-07-29", time: "09:05" }}
        initialState={initialState}
        pageData={pageData}
        requester={{ displayName: "Alain Alemany", employeeNumber: "911601" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("inactive");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue(
      "Preserved narrative",
    );
    expect(screen.getByText("Choose an active supervisor.")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity for A-1")).toHaveValue(2);
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("renders current Requested detail from snapshots with approved lifecycle controls", () => {
    render(<SupplyRequestDetail detail={detail} />);
    expect(screen.getAllByText("SR-2026-0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Requested").length).toBeGreaterThan(0);
    expect(screen.getByText("Mine A · Wright, WY")).toBeInTheDocument();
    expect(screen.getByText("No Notes recorded.")).toBeInTheDocument();
    expect(screen.getByText("No corrections recorded")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View original version 1" }),
    ).toHaveAttribute("href", "/supply-requests/request-1/history/1");
    expect(screen.getByRole("link", { name: "Open Daily Work Log" })).toHaveAttribute(
      "href",
      "/daily-logs/new",
    );
    expect(screen.getByRole("link", { name: "Fulfill" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1/fulfill",
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1/cancel",
    );
    expect(screen.queryByText(/Reopen|Correct Request|Delete/)).toBeNull();
  });

  it("renders immutable original state and missing-live-Equipment guidance", () => {
    render(
      <SupplyRequestDetail
        detail={{ ...detail, equipmentAvailable: false, equipmentId: null }}
        historical
      />,
    );
    expect(screen.getByText("Read-only historical record")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "live Equipment record is unavailable",
    );
    expect(screen.getByRole("link", { name: "Back to current detail" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1",
    );
  });

  it("renders all three routes and uses not-found for missing details", async () => {
    render(await NewSupplyRequestPage());
    expect(
      screen.getByRole("heading", { name: "Record submitted Supply Request" }),
    ).toBeInTheDocument();
    cleanup();

    render(
      await SupplyRequestDetailPage({
        params: Promise.resolve({ id: "request-1" }),
      }),
    );
    expect(screen.getAllByText("SR-2026-0001").length).toBeGreaterThan(0);
    cleanup();

    render(
      await SupplyRequestOriginalVersionPage({
        params: Promise.resolve({ id: "request-1", version: "1" }),
      }),
    );
    expect(screen.getByText("Read-only historical record")).toBeInTheDocument();
    cleanup();

    mocks.currentDetail.mockResolvedValue(null);
    await expect(
      SupplyRequestDetailPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow("not-found");

    mocks.originalDetail.mockResolvedValue(null);
    await expect(
      SupplyRequestOriginalVersionPage({
        params: Promise.resolve({ id: "request-1", version: "2" }),
      }),
    ).rejects.toThrow("not-found");
  });
});
