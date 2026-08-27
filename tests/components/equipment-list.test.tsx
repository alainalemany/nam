import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEquipment: vi.fn(),
  getMineOptions: vi.fn(),
}));

vi.mock("@/features/equipment/data", () => ({
  getEquipment: mocks.getEquipment,
  getEquipmentMineOptions: mocks.getMineOptions,
}));

import EquipmentPage from "@/app/equipment/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Equipment list", () => {
  it("renders combined canonical filters and preserves the existing table actions", async () => {
    mocks.getMineOptions.mockResolvedValue([
      {
        id: "mine-1",
        label: "White Rock Quarry (Miami, FL)",
        cityLabel: "Miami, FL",
        mineType: "Quarry",
        status: "ACTIVE",
      },
      {
        id: "mine-2",
        label: "North Mine (Gillette, WY)",
        cityLabel: "Gillette, WY",
        mineType: "Strip Mine",
        status: "ACTIVE",
      },
    ]);
    mocks.getEquipment.mockResolvedValue([
      {
        id: "equipment-1",
        displayName: "MTECK 2100E",
        equipmentNumber: "DL-01",
        category: "DRAGLINE",
        status: "ACTIVE",
        mine: {
          name: "White Rock Quarry",
          city: { name: "Miami", state: "FL" },
        },
      },
    ]);

    render(
      await EquipmentPage({
        searchParams: Promise.resolve({
          category: "DRAGLINE",
          mineId: "mine-1",
          q: "2100",
          status: "ACTIVE",
        }),
      }),
    );

    expect(mocks.getEquipment).toHaveBeenCalledWith({
      category: "DRAGLINE",
      mineId: "mine-1",
      q: "2100",
      status: "ACTIVE",
    });
    expect(mocks.getMineOptions).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Search")).toHaveValue("2100");
    expect(screen.getByLabelText("Category")).toHaveValue("DRAGLINE");
    expect(screen.getByLabelText("Mine")).toHaveValue("mine-1");
    expect(screen.getByLabelText("Status")).toHaveValue("ACTIVE");

    const category = screen.getByLabelText("Category");
    expect(within(category).getByRole("option", { name: "All equipment" })).toBeInTheDocument();
    expect(within(category).getByRole("option", { name: "Work truck" })).toBeInTheDocument();
    expect(within(category).getByRole("option", { name: "Tractor" })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Mine")).getByRole("option", {
        name: "White Rock Quarry (Miami, FL)",
      }),
    ).toBeInTheDocument();

    const row = screen.getByText("MTECK 2100E").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText("#DL-01")).toBeInTheDocument();
    expect(within(row!).getByText("White Rock Quarry")).toBeInTheDocument();
    expect(within(row!).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/equipment/equipment-1/edit",
    );
    expect(screen.getByText("1", { selector: ".count-pill" })).toBeInTheDocument();
  });

  it("shows a filtered empty state without changing the New Equipment action", async () => {
    mocks.getMineOptions.mockResolvedValue([]);
    mocks.getEquipment.mockResolvedValue([]);

    render(
      await EquipmentPage({
        searchParams: Promise.resolve({ status: "INACTIVE" }),
      }),
    );

    expect(screen.getByText(/adjust the filters/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear Filters" })).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "New Equipment" })).toHaveAttribute(
      "href",
      "/equipment/new",
    );
  });
});
