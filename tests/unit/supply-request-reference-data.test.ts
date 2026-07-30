import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  itemFindMany: vi.fn(),
  itemCount: vi.fn(),
  itemFindUnique: vi.fn(),
  supervisorFindMany: vi.fn(),
  supervisorCount: vi.fn(),
  supervisorFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyItem: {
      findMany: mocks.itemFindMany,
      count: mocks.itemCount,
      findUnique: mocks.itemFindUnique,
    },
    supplyRequestSupervisor: {
      findMany: mocks.supervisorFindMany,
      count: mocks.supervisorCount,
      findUnique: mocks.supervisorFindUnique,
    },
  },
}));

import {
  getSupervisorManagementList,
  getSupervisorForEdit,
  getSupplyItemManagementList,
  getSupplyItemForEdit,
} from "@/features/supply-requests/reference-data";

describe("Supply Request reference queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.itemFindMany.mockResolvedValue([]);
    mocks.itemCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mocks.supervisorFindMany.mockResolvedValue([]);
    mocks.supervisorCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mocks.itemFindUnique.mockResolvedValue(null);
    mocks.supervisorFindUnique.mockResolvedValue(null);
  });

  it("builds database-owned Supply Item search, status, order, and pagination", async () => {
    mocks.itemCount.mockReset();
    mocks.itemCount.mockResolvedValueOnce(100).mockResolvedValueOnce(100);
    await getSupplyItemManagementList({
      q: "ab-12",
      status: "inactive",
      page: 2,
    });
    expect(mocks.itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: false,
          OR: [
            { normalizedItemNumber: { contains: "AB-12" } },
            { itemNumber: { contains: "ab-12", mode: "insensitive" } },
            { description: { contains: "ab-12", mode: "insensitive" } },
          ],
        },
        orderBy: [
          { active: "desc" },
          { itemNumber: "asc" },
          { id: "asc" },
        ],
        skip: 50,
        take: 50,
      }),
    );
  });

  it("returns narrow display-ready Supply Item rows", async () => {
    mocks.itemFindMany.mockResolvedValue([
      {
        id: "item-1",
        itemNumber: "AB-12",
        description: "Filter",
        unitOfMeasure: "Each",
        active: true,
        _count: { versionItems: 3 },
      },
    ]);
    mocks.itemCount.mockReset();
    mocks.itemCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await expect(
      getSupplyItemManagementList({ status: "all", page: 1 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: "item-1",
          unit: "Each",
          historicalUseCount: 3,
        },
      ],
    });
  });

  it("builds database-owned supervisor search and deterministic order", async () => {
    mocks.supervisorCount.mockReset();
    mocks.supervisorCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await getSupervisorManagementList({
      q: "Pablo@Example.COM",
      status: "active",
      page: 1,
    });
    expect(mocks.supervisorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          OR: [
            {
              fullName: {
                contains: "Pablo@Example.COM",
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: "Pablo@Example.COM",
                mode: "insensitive",
              },
            },
            {
              normalizedEmail: { contains: "pablo@example.com" },
            },
          ],
        },
        orderBy: [
          { active: "desc" },
          { fullName: "asc" },
          { id: "asc" },
        ],
      }),
    );
  });

  it("reports deterministic page availability", async () => {
    mocks.supervisorCount.mockReset();
    mocks.supervisorCount.mockResolvedValueOnce(101).mockResolvedValueOnce(101);
    await expect(
      getSupervisorManagementList({ status: "all", page: 2 }),
    ).resolves.toMatchObject({
      page: 2,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it("returns page overflow without passing an unsafe offset to Prisma", async () => {
    mocks.itemCount.mockReset();
    mocks.itemCount.mockResolvedValueOnce(10).mockResolvedValueOnce(10);
    const result = await getSupplyItemManagementList({
      status: "all",
      page: Number.MAX_SAFE_INTEGER,
    });
    expect(result).toMatchObject({
      items: [],
      page: Number.MAX_SAFE_INTEGER,
      hasPreviousPage: true,
      hasNextPage: false,
    });
    expect(mocks.itemFindMany).not.toHaveBeenCalled();
  });

  it("validates edit IDs and returns display-ready edit records", async () => {
    await expect(getSupplyItemForEdit(" ".repeat(101))).resolves.toBeNull();
    expect(mocks.itemFindUnique).not.toHaveBeenCalled();

    mocks.itemFindUnique.mockResolvedValue({
      id: "item-1",
      itemNumber: "AB-1",
      description: "Filter",
      unitOfMeasure: "Each",
      active: true,
      _count: { versionItems: 2 },
    });
    await expect(getSupplyItemForEdit(" item-1 ")).resolves.toEqual({
      id: "item-1",
      itemNumber: "AB-1",
      description: "Filter",
      unitOfMeasure: "Each",
      active: true,
      historicalUseCount: 2,
    });
    expect(mocks.itemFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "item-1" } }),
    );

    mocks.supervisorFindUnique.mockResolvedValue({
      id: "supervisor-1",
      fullName: "Pablo Gonzalez",
      email: "pablo@example.com",
      active: false,
      _count: { versions: 3 },
    });
    await expect(getSupervisorForEdit("supervisor-1")).resolves.toEqual({
      id: "supervisor-1",
      fullName: "Pablo Gonzalez",
      email: "pablo@example.com",
      active: false,
      historicalUseCount: 3,
    });
  });
});
