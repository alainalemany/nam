import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SupplyRequestsPage from "@/app/supply-requests/page";

const mocks = vi.hoisted(() => ({ getPage: vi.fn() }));
vi.mock("@/features/supply-requests/history-data", () => ({
  getSupplyRequestHistoryPage: mocks.getPage,
}));

const ready = (overrides: Record<string, unknown> = {}) => ({
  status: "ready",
  rows: [
    {
      supplyRequestId: "request/one",
      namReference: "SR-2026-0001",
      versionNumber: 3,
      status: "FULFILLED",
      statusLabel: "Fulfilled",
      operationalWorkDate: "2026-07-15",
      submittedLocalDate: "2026-07-16",
      submittedLocalTime: "09:30",
      equipmentLabel: "Historic Dragline · DL-7",
      equipmentNumber: "DL-7",
      mineName: "Historic Mine",
      cityLabel: "Gillette, WY",
      supervisorName: "Historic Supervisor",
      itemCount: 2,
      detailHref: "/supply-requests/request%2Fone",
    },
  ],
  equipmentOptions: [
    { id: "equipment-1", label: "Live Dragline · DL-7", active: false },
  ],
  supervisorOptions: [
    {
      id: "supervisor-1",
      label: "Supervisor · supervisor@example.com",
      active: true,
    },
  ],
  totalCount: 1,
  matchingCount: 1,
  page: 1,
  hasPreviousPage: false,
  hasNextPage: false,
  ...overrides,
});

beforeEach(() => mocks.getPage.mockResolvedValue(ready()));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Supply Request history route", () => {
  it("renders the canonical NAM-only header, management actions, and all filters", async () => {
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Supply Requests" })).toBeVisible();
    expect(screen.getByText(/does not submit or modify corporate requests/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Record Submitted Request" })).toHaveAttribute("href", "/supply-requests/new");
    expect(screen.getByRole("link", { name: "Manage Supply Items" })).toHaveAttribute("href", "/supply-requests/items");
    expect(screen.getByRole("link", { name: "Manage Supervisors" })).toHaveAttribute("href", "/supply-requests/supervisors");
    for (const label of ["Operational Date From", "Operational Date To", "Status", "Equipment", "Supervisor", "NAM Reference", "Item Number or Description", "Notes"]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.getByRole("button", { name: "Apply Filters" })).toHaveAttribute("type", "submit");
  });

  it("renders pointer-owned snapshot rows and only stable current-detail links", async () => {
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Historic Dragline · DL-7")).toBeVisible();
    expect(screen.getByText("Historic Supervisor")).toBeVisible();
    expect(screen.getAllByText("Fulfilled")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "View current request" })).toHaveAttribute("href", "/supply-requests/request%2Fone");
    expect(screen.queryByText(/superseded/i)).toBeNull();
  });

  it("reflects normalized first values, inactive options, and unknown bounded selections safely", async () => {
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({
      status: ["REQUESTED", "CANCELLED"],
      equipmentId: ["unknown-equipment", "equipment-1"],
      supervisorId: ["unknown-supervisor", "supervisor-1"],
      reference: " sr-2026-0001 ",
    }) }));
    expect(mocks.getPage).toHaveBeenCalledWith({ page: 1, status: "REQUESTED", equipmentId: "unknown-equipment", supervisorId: "unknown-supervisor", reference: "SR-2026-0001" });
    expect(screen.getByLabelText("Status")).toHaveValue("REQUESTED");
    expect(screen.getByLabelText("Equipment")).toHaveValue("unknown-equipment");
    expect(screen.getAllByRole("option", { name: "Unavailable historical reference" })).toHaveLength(2);
    expect(screen.getByLabelText("Supervisor")).toHaveValue("unknown-supervisor");
    expect(within(screen.getByLabelText("Equipment")).getByRole("option", { name: "Live Dragline · DL-7 (Inactive)" })).toBeVisible();
  });

  it("shows bounded invalid-filter notice and preserves normalized pagination links", async () => {
    mocks.getPage.mockResolvedValue(ready({ matchingCount: 101, hasNextPage: true }));
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({ dateFrom: "bad", notes: " Pump & seal ", sort: "ignored" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("unsupported parameters, dateFrom");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/supply-requests?notes=Pump+%26+seal&page=2");
  });

  it("distinguishes unfiltered, filtered, and out-of-range empty states", async () => {
    mocks.getPage.mockResolvedValueOnce(ready({ rows: [], totalCount: 0, matchingCount: 0 }));
    const first = render(await SupplyRequestsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "No Supply Requests have been recorded yet" })).toBeVisible();
    first.unmount();
    mocks.getPage.mockResolvedValueOnce(ready({ rows: [], totalCount: 2, matchingCount: 0 }));
    const second = render(await SupplyRequestsPage({ searchParams: Promise.resolve({ status: "CANCELLED" }) }));
    expect(screen.getByRole("heading", { name: "No current Supply Requests match these filters" })).toBeVisible();
    second.unmount();
    mocks.getPage.mockResolvedValueOnce(ready({ rows: [], totalCount: 60, matchingCount: 60, page: 3, hasPreviousPage: true }));
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({ page: "3" }) }));
    expect(screen.getByRole("heading", { name: "No Supply Requests on this page" })).toBeVisible();
    expect(screen.getByRole("link", { name: "First page" })).toHaveAttribute("href", "/supply-requests?page=1");
  });

  it("uses filtered no-results rather than the unfiltered empty state when no roots exist but filters are active", async () => {
    mocks.getPage.mockResolvedValue(
      ready({ rows: [], totalCount: 0, matchingCount: 0 }),
    );
    render(
      await SupplyRequestsPage({
        searchParams: Promise.resolve({ equipmentId: "unknown-equipment" }),
      }),
    );
    expect(
      screen.getByRole("heading", {
        name: "No current Supply Requests match these filters",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "No Supply Requests have been recorded yet",
      }),
    ).toBeNull();
  });

  it("renders reversed valid ranges as an ordinary filtered no-results state", async () => {
    mocks.getPage.mockResolvedValue(ready({ rows: [], totalCount: 2, matchingCount: 0 }));
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({ dateFrom: "2026-12-31", dateTo: "2026-01-01" }) }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("heading", { name: "No current Supply Requests match these filters" })).toBeVisible();
  });

  it("renders query failure distinctly without claiming an empty result", async () => {
    mocks.getPage.mockResolvedValue({ status: "error", message: "Supply Request history is temporarily unavailable. Try loading this page again." });
    render(await SupplyRequestsPage({ searchParams: Promise.resolve({ notes: "urgent" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByText(/No Supply Requests have been recorded/)).toBeNull();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/supply-requests?notes=urgent&page=1");
  });
});
