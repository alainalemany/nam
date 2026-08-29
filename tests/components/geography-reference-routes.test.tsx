import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  states: vi.fn(),
  state: vi.fn(),
  stateOptions: vi.fn(),
  cities: vi.fn(),
  city: vi.fn(),
  createState: vi.fn(),
  updateState: vi.fn(),
  stateStatus: vi.fn(),
  createCity: vi.fn(),
  updateCity: vi.fn(),
  cityStatus: vi.fn(),
}));

vi.mock("@/features/geography/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/geography/data")>("@/features/geography/data");
  return {
    ...actual,
    getStateManagementList: mocks.states,
    getStateForEdit: mocks.state,
    getStateOptions: mocks.stateOptions,
    getCityManagementList: mocks.cities,
    getCityForEdit: mocks.city,
  };
});
vi.mock("@/features/geography/actions", () => ({
  createStateAction: mocks.createState,
  updateStateAction: mocks.updateState,
  changeStateStatusAction: mocks.stateStatus,
  createCityAction: mocks.createCity,
  updateCityAction: mocks.updateCity,
  changeCityStatusAction: mocks.cityStatus,
}));

import CitiesPage from "@/app/reference-data/cities/page";
import EditCityPage from "@/app/reference-data/cities/[id]/edit/page";
import NewCityPage from "@/app/reference-data/cities/new/page";
import ReferenceDataPage from "@/app/reference-data/page";
import StatesPage from "@/app/reference-data/states/page";
import EditStatePage from "@/app/reference-data/states/[id]/edit/page";
import NewStatePage from "@/app/reference-data/states/new/page";

const florida = {
  id: "fl",
  name: "Florida",
  abbreviation: "FL",
  normalizedKey: "florida",
  status: "ACTIVE",
  _count: { cities: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};
const medley = {
  id: "medley",
  name: "Medley",
  state: "FL",
  stateId: "fl",
  normalizedKey: "medley",
  status: "ACTIVE",
  stateReference: florida,
  _count: { mines: 0, gasStations: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.states.mockResolvedValue([florida]);
  mocks.state.mockResolvedValue(florida);
  mocks.stateOptions.mockResolvedValue([florida]);
  mocks.cities.mockResolvedValue({ cities: [medley], total: 1 });
  mocks.city.mockResolvedValue(medley);
});
afterEach(cleanup);

describe("geography Reference Data routes", () => {
  it("offers discoverable State and City management", () => {
    render(<ReferenceDataPage />);
    expect(screen.getByRole("link", { name: "Manage States" })).toHaveAttribute("href", "/reference-data/states");
    expect(screen.getByRole("link", { name: "Manage Cities" })).toHaveAttribute("href", "/reference-data/cities");
  });

  it("lists, searches, edits, and inactivates States without delete", async () => {
    render(await StatesPage({ searchParams: Promise.resolve({ q: "Florida", status: "ACTIVE" }) }));
    expect(screen.getByRole("heading", { name: "U.S. States", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Florida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Inactive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("renders State create and edit forms", async () => {
    const { unmount } = render(await NewStatePage());
    expect(screen.getByLabelText("State name")).toBeInTheDocument();
    expect(screen.getByLabelText("Abbreviation")).toBeInTheDocument();
    unmount();
    render(await EditStatePage({ params: Promise.resolve({ id: "fl" }) }));
    expect(screen.getByLabelText("State name")).toHaveValue("Florida");
    expect(screen.getByLabelText("Abbreviation")).toHaveValue("FL");
  });

  it("lists Cities with State filter, references, and no delete", async () => {
    render(await CitiesPage({ searchParams: Promise.resolve({ q: "Medley", stateId: "fl" }) }));
    expect(screen.getByRole("heading", { name: "U.S. Cities", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Medley, FL")).toBeInTheDocument();
    expect(screen.getByText("0 Mines · 1 Gas Stations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("renders City create and edit forms against canonical States", async () => {
    const { unmount } = render(await NewCityPage());
    expect(screen.getByLabelText("City name")).toBeInTheDocument();
    expect(screen.getByLabelText("State")).toHaveDisplayValue("Select State");
    unmount();
    render(await EditCityPage({ params: Promise.resolve({ id: "medley" }) }));
    expect(screen.getByLabelText("City name")).toHaveValue("Medley");
    expect(screen.getByLabelText("State")).toHaveValue("fl");
  });
});
