import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  state: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  city: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
};
const mocks = vi.hoisted(() => ({ stateUpdate: vi.fn(), cityUpdate: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
    state: { update: mocks.stateUpdate },
    city: { update: mocks.cityUpdate },
  },
}));

import {
  GeographyPersistenceError,
  saveCity,
  saveState,
  setCityStatus,
  setStateStatus,
} from "@/features/geography/persistence";
import { citySubmissionSchema, stateSubmissionSchema } from "@/features/geography/validation";

beforeEach(() => {
  vi.clearAllMocks();
  tx.state.findUnique.mockResolvedValue(null);
  tx.state.create.mockResolvedValue({ id: "fl", name: "Florida", abbreviation: "FL" });
  tx.state.update.mockResolvedValue({ id: "fl", name: "Florida", abbreviation: "FL" });
  tx.city.findUnique.mockResolvedValue(null);
  tx.city.create.mockResolvedValue({ id: "medley", name: "Medley", stateId: "fl" });
  tx.city.update.mockResolvedValue({ id: "medley", name: "Medley", stateId: "fl" });
  tx.city.updateMany.mockResolvedValue({ count: 1 });
  mocks.stateUpdate.mockResolvedValue({});
  mocks.cityUpdate.mockResolvedValue({});
});

describe("State and City management persistence", () => {
  it("normalizes and creates a State as active", async () => {
    const input = stateSubmissionSchema.parse({ name: "  District   of Columbia ", abbreviation: "dc" });
    expect(input).toEqual({ name: "District of Columbia", abbreviation: "DC" });
    await saveState(input);
    expect(tx.state.create).toHaveBeenCalledWith({
      data: { name: "District of Columbia", abbreviation: "DC", normalizedKey: "district of columbia", status: "ACTIVE" },
    });
  });

  it("edits a State and keeps legacy City abbreviations synchronized", async () => {
    tx.state.findUnique.mockResolvedValue({ id: "fl", abbreviation: "XX" });
    await saveState(stateSubmissionSchema.parse({ name: "Florida", abbreviation: "FL" }), "fl");
    expect(tx.city.updateMany).toHaveBeenCalledWith({ where: { stateId: "fl" }, data: { state: "FL" } });
  });

  it("creates the same City name in different States and rejects inactive new State selection", async () => {
    const input = citySubmissionSchema.parse({ name: "Portland", stateId: "or" });
    tx.state.findUnique.mockResolvedValue({ id: "or", abbreviation: "OR", status: "ACTIVE" });
    await saveCity(input);
    expect(tx.city.create).toHaveBeenCalledWith({
      data: { name: "Portland", normalizedKey: "portland", state: "OR", stateId: "or", status: "ACTIVE" },
    });
    tx.state.findUnique.mockResolvedValue({ id: "me", abbreviation: "ME", status: "ACTIVE" });
    await saveCity(citySubmissionSchema.parse({ name: "Portland", stateId: "me" }));
    expect(tx.city.create).toHaveBeenLastCalledWith({
      data: { name: "Portland", normalizedKey: "portland", state: "ME", stateId: "me", status: "ACTIVE" },
    });

    tx.state.findUnique.mockResolvedValue({ id: "xx", abbreviation: "XX", status: "INACTIVE" });
    await expect(saveCity(citySubmissionSchema.parse({ name: "Example", stateId: "xx" })))
      .rejects.toMatchObject({ field: "stateId" });
  });

  it("maps normalized uniqueness conflicts and toggles status without delete", async () => {
    tx.state.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "duplicate",
      { code: "P2002", clientVersion: "6.19.3" },
    ));
    await expect(saveState(stateSubmissionSchema.parse({ name: "Florida", abbreviation: "FL" })))
      .rejects.toBeInstanceOf(GeographyPersistenceError);
    await setStateStatus("fl", false);
    await setCityStatus("medley", false);
    expect(mocks.stateUpdate).toHaveBeenCalledWith({ where: { id: "fl" }, data: { status: "INACTIVE" } });
    expect(mocks.cityUpdate).toHaveBeenCalledWith({ where: { id: "medley" }, data: { status: "INACTIVE" } });
  });
});
