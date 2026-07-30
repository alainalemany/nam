import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SupplyItemEditPage from "@/app/supply-requests/items/[id]/edit/page";
import NewSupplyItemPage from "@/app/supply-requests/items/new/page";
import SupplyItemsPage from "@/app/supply-requests/items/page";
import SupervisorEditPage from "@/app/supply-requests/supervisors/[id]/edit/page";
import NewSupervisorPage from "@/app/supply-requests/supervisors/new/page";
import SupervisorsPage from "@/app/supply-requests/supervisors/page";

const mocks = vi.hoisted(() => ({
  getItemList: vi.fn(),
  getItem: vi.fn(),
  getSupervisorList: vi.fn(),
  getSupervisor: vi.fn(),
}));

vi.mock("@/features/supply-requests/reference-data", () => ({
  getSupplyItemManagementList: mocks.getItemList,
  getSupplyItemForEdit: mocks.getItem,
  getSupervisorManagementList: mocks.getSupervisorList,
  getSupervisorForEdit: mocks.getSupervisor,
}));

function itemList(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "item-1",
        itemNumber: "SUP-100",
        description: "Shop towels",
        unit: "Case",
        active: false,
        historicalUseCount: 2,
      },
    ],
    totalCount: 1,
    matchingCount: 1,
    page: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides,
  };
}

function supervisorList(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "supervisor-1",
        fullName: "Pablo Gonzalez",
        email: "Pablo.Gonzalez@example.com",
        active: true,
        historicalUseCount: 1,
      },
    ],
    totalCount: 1,
    matchingCount: 1,
    page: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getItemList.mockResolvedValue(itemList());
  mocks.getSupervisorList.mockResolvedValue(supervisorList());
  mocks.getItem.mockResolvedValue({
    id: "item-1",
    itemNumber: "SUP-100",
    description: "Shop towels",
    unitOfMeasure: "Case",
    active: false,
    historicalUseCount: 2,
  });
  mocks.getSupervisor.mockResolvedValue({
    id: "supervisor-1",
    fullName: "Pablo Gonzalez",
    email: "Pablo.Gonzalez@example.com",
    active: true,
    historicalUseCount: 1,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Supply Request reference-management routes", () => {
  it("renders Supply Items with normalized filters, status, actions, and warning", async () => {
    render(
      await SupplyItemsPage({
        searchParams: Promise.resolve({
          q: [" SUP-100 ", "ignored"],
          status: " inactive ",
        }),
      }),
    );

    expect(mocks.getItemList).toHaveBeenCalledWith({
      q: "SUP-100",
      status: "inactive",
      page: 1,
    });
    expect(screen.getByRole("heading", { name: "Supply Items" })).toBeInTheDocument();
    expect(screen.getByText("SUP-100")).toBeInTheDocument();
    expect(screen.getByText("Shop towels")).toBeInTheDocument();
    expect(screen.getByText("Case")).toBeInTheDocument();
    expect(screen.getAllByText("Inactive")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/supply-requests/items/item-1/edit",
    );
    expect(screen.getByText(/preserves every historical Supply Request/)).toBeInTheDocument();
    expect(screen.getByText(/Existing historical Supply Requests are not changed/)).toBeInTheDocument();
  });

  it("renders supervisors and preserves normalized filters in pagination", async () => {
    mocks.getSupervisorList.mockResolvedValue(
      supervisorList({ matchingCount: 51, hasNextPage: true }),
    );
    render(
      await SupervisorsPage({
        searchParams: Promise.resolve({ q: " Pablo ", status: "active" }),
      }),
    );

    expect(screen.getByText("Pablo.Gonzalez@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Inactivate" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/supply-requests/supervisors?q=Pablo&status=active&page=2",
    );
    expect(screen.getByText(/Existing historical Supply Requests are not changed/)).toBeInTheDocument();
  });

  it("distinguishes empty catalogs from filtered no-results states", async () => {
    mocks.getItemList.mockResolvedValue(
      itemList({ items: [], totalCount: 0, matchingCount: 0 }),
    );
    const first = render(
      await SupplyItemsPage({ searchParams: Promise.resolve({}) }),
    );
    expect(screen.getByRole("heading", { name: "No Supply Items yet" })).toBeInTheDocument();
    first.unmount();

    mocks.getSupervisorList.mockResolvedValue(
      supervisorList({ items: [], totalCount: 3, matchingCount: 0 }),
    );
    render(
      await SupervisorsPage({
        searchParams: Promise.resolve({ q: "missing" }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "No supervisors match these filters" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear Filters" })).toHaveLength(2);
  });

  it("renders an intentional page-overflow state with a canonical previous link", async () => {
    mocks.getItemList.mockResolvedValue(
      itemList({
        items: [],
        totalCount: 4,
        matchingCount: 4,
        page: Number.MAX_SAFE_INTEGER,
        hasPreviousPage: true,
      }),
    );
    render(
      await SupplyItemsPage({
        searchParams: Promise.resolve({
          q: " SUP ",
          status: "inactive",
          page: String(Number.MAX_SAFE_INTEGER),
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "No Supply Items on this page" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      `/supply-requests/items?q=SUP&status=inactive&page=${Number.MAX_SAFE_INTEGER - 1}`,
    );
  });

  it("renders create forms without normalized keys or active-state inputs", async () => {
    const first = render(await NewSupplyItemPage());
    expect(screen.getByRole("heading", { name: "Add Supply Item" })).toBeInTheDocument();
    expect(screen.getByLabelText("Item Number")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Unit")).toBeInTheDocument();
    expect(screen.queryByLabelText(/normalized/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Item Number")).not.toHaveAttribute(
      "aria-describedby",
    );
    first.unmount();

    render(await NewSupervisorPage());
    expect(screen.getByRole("heading", { name: "Add Supervisor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders authoritative edit values, status controls, and retirement guidance", async () => {
    const first = render(
      await SupplyItemEditPage({ params: Promise.resolve({ id: "item-1" }) }),
    );
    expect(screen.getByLabelText("Item Number")).toHaveValue("SUP-100");
    expect(screen.getByLabelText("Description")).toHaveValue("Shop towels");
    expect(screen.getByLabelText("Unit")).toHaveValue("Case");
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.getByText(/2 historical request versions/)).toBeInTheDocument();
    first.unmount();

    render(
      await SupervisorEditPage({
        params: Promise.resolve({ id: "supervisor-1" }),
      }),
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Pablo Gonzalez");
    expect(screen.getByLabelText("Email")).toHaveValue(
      "Pablo.Gonzalez@example.com",
    );
    expect(screen.getByRole("button", { name: "Inactivate" })).toBeInTheDocument();
    expect(screen.getByText(/1 historical request versions/)).toBeInTheDocument();
  });

  it("uses the repository not-found boundary for missing edit records", async () => {
    mocks.getItem.mockResolvedValue(null);
    await expect(
      SupplyItemEditPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);

    mocks.getSupervisor.mockResolvedValue(null);
    await expect(
      SupervisorEditPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
