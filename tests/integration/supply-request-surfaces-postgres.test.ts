import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SupplyRequestCreateError } from "@/features/supply-requests/errors";
import { createSupplyRequestWithDependencies } from "@/features/supply-requests/persistence-internal";
import {
  getCurrentSupplyRequestDetailWithClient,
  getOriginalSupplyRequestDetailWithClient,
  searchActiveSupplyRequestEquipmentWithClient,
  searchActiveSupplyRequestItemsWithClient,
  searchActiveSupplyRequestSupervisorsWithClient,
  supplyRequestOptionLimit,
} from "@/features/supply-requests/surface-data-internal";
import { parseSupplyRequestCreateFormData } from "@/features/supply-requests/surface-validation";

const expectedTestDatabaseName = "nam_supply_request_test";
const testPrefix = "supply-surface-";
const normalizedTestPrefix = testPrefix.toUpperCase();
const reservedYears = Array.from({ length: 20 }, (_, index) => 6600 + index);

function guardedDatabaseUrl() {
  const value = process.env.SUPPLY_REQUEST_TEST_DATABASE_URL;
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "SUPPLY_REQUEST_TEST_DATABASE_URL must be a valid PostgreSQL URL.",
    );
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    databaseName !== expectedTestDatabaseName
  ) {
    throw new Error(
      `Supply Request surface tests require the disposable ${expectedTestDatabaseName} database.`,
    );
  }
  return value;
}

const databaseUrl = guardedDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;

let ordinal = 0;
function uniqueLabel(label: string) {
  ordinal += 1;
  return `${testPrefix}${label}-${Date.now().toString(36)}-${ordinal}`;
}

async function cleanPhaseData() {
  if (!client) return;
  await client.supplyRequest.deleteMany({
    where: { referenceYear: { in: reservedYears } },
  });
  await client.supplyRequestReferenceCounter.deleteMany({
    where: { referenceYear: { in: reservedYears } },
  });
  await client.supplyItem.deleteMany({
    where: { normalizedItemNumber: { startsWith: normalizedTestPrefix } },
  });
  await client.supplyRequestSupervisor.deleteMany({
    where: { normalizedEmail: { startsWith: testPrefix } },
  });
  await client.equipment.deleteMany({
    where: { id: { startsWith: testPrefix } },
  });
  await client.mine.deleteMany({ where: { id: { startsWith: testPrefix } } });
  await client.city.deleteMany({ where: { id: { startsWith: testPrefix } } });
}

async function fixture(label: string, itemCount = 2) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const prefix = uniqueLabel(label);
  const city = await client.city.create({
    data: {
      id: `${prefix}-city`,
      name: `${prefix} City`,
      state: "WY",
    },
  });
  const mine = await client.mine.create({
    data: {
      id: `${prefix}-mine`,
      cityId: city.id,
      name: `${prefix} Mine`,
    },
  });
  const equipment = await client.equipment.create({
    data: {
      id: `${prefix}-equipment`,
      mineId: mine.id,
      displayName: `${prefix} Dragline`,
      equipmentNumber: "101",
      category: "DRAGLINE",
    },
  });
  const supervisor = await client.supplyRequestSupervisor.create({
    data: {
      id: `${prefix}-supervisor`,
      fullName: `${prefix} Supervisor`,
      email: `${prefix}@Example.com`,
      normalizedEmail: `${prefix}@example.com`,
    },
  });
  const items = await Promise.all(
    Array.from({ length: itemCount }, (_, index) =>
      client.supplyItem.create({
        data: {
          id: `${prefix}-item-${index}`,
          itemNumber: `${prefix} Item ${index}`,
          normalizedItemNumber: `${prefix.toUpperCase()} ITEM ${index}`,
          description: `Description ${index}`,
          unitOfMeasure: index === 0 ? "Each" : "Case",
        },
      }),
    ),
  );
  return { prefix, city, mine, equipment, supervisor, items };
}

function formData(
  year: number,
  references: Awaited<ReturnType<typeof fixture>>,
) {
  const data = new FormData();
  data.set("operationalWorkDate", `${year - 1}-12-31`);
  data.set("submittedLocalDate", `${year}-01-01`);
  data.set("submittedLocalTime", "00:15");
  data.set("equipmentId", references.equipment.id);
  data.set("supervisorId", references.supervisor.id);
  data.set("notes", "Corporate submission recorded.");
  data.set(
    "itemsPayload",
    JSON.stringify(
      references.items.map((item, index) => ({
        supplyItemId: item.id,
        quantity: index + 2,
      })),
    ),
  );
  data.set("corporateSubmissionConfirmed", "true");
  return data;
}

async function createFromForm(
  year: number,
  references: Awaited<ReturnType<typeof fixture>>,
) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const parsed = parseSupplyRequestCreateFormData(formData(year, references));
  return createSupplyRequestWithDependencies(parsed.input, { client });
}

async function phaseCounts() {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  return {
    roots: await client.supplyRequest.count({
      where: { referenceYear: { in: reservedYears } },
    }),
    versions: await client.supplyRequestVersion.count({
      where: { supplyRequest: { referenceYear: { in: reservedYears } } },
    }),
    lines: await client.supplyRequestVersionItem.count({
      where: {
        version: { supplyRequest: { referenceYear: { in: reservedYears } } },
      },
    }),
    counters: await client.supplyRequestReferenceCounter.count({
      where: { referenceYear: { in: reservedYears } },
    }),
  };
}

describePostgres("Supply Request create and initial-detail PostgreSQL behavior", () => {
  beforeAll(cleanPhaseData);
  afterAll(async () => {
    await cleanPhaseData();
    await client?.$disconnect();
  });

  it("records one complete server-owned aggregate and reads current and original snapshots", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("complete");
    const dailyLogCount = await client.dailyLog.count();
    const dailyLogActivityCount = await client.dailyLogActivity.count();
    const result = await createFromForm(6600, references);
    const root = await client.supplyRequest.findUniqueOrThrow({
      where: { id: result.supplyRequestId },
      include: {
        versions: { include: { items: { orderBy: { sequence: "asc" } } } },
      },
    });
    expect(root).toMatchObject({
      namReference: "SR-6600-0001",
      referenceYear: 6600,
      referenceSequence: 1,
      currentVersionId: result.currentVersionId,
    });
    expect(root.versions).toHaveLength(1);
    expect(root.versions[0]).toMatchObject({
      id: result.currentVersionId,
      versionNumber: 1,
      changeKind: "CREATED",
      status: "REQUESTED",
      requesterDisplayNameSnapshot: "Alain Alemany",
      requesterEmployeeNumberSnapshot: "911601",
      equipmentDisplayNameSnapshot: references.equipment.displayName,
      supervisorNameSnapshot: references.supervisor.fullName,
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      cancelledLocalDate: null,
      correctionReason: null,
    });
    expect(root.versions[0].items.map((line) => line.sequence)).toEqual([1, 2]);
    expect(root.versions[0].items[0]).toMatchObject({
      itemNumberSnapshot: references.items[0].itemNumber,
      unitOfMeasureSnapshot: references.items[0].unitOfMeasure,
      quantity: 2,
    });

    const current = await getCurrentSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
    );
    const original = await getOriginalSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
      "1",
    );
    expect(current).toMatchObject({
      versionId: result.currentVersionId,
      status: "REQUESTED",
      operationalWorkDate: "6599-12-31",
      submittedLocalDate: "6600-01-01",
      items: [{ sequence: 1 }, { sequence: 2 }],
    });
    expect(original).toEqual(current);
    await expect(
      getOriginalSupplyRequestDetailWithClient(
        client,
        result.supplyRequestId,
        "2",
      ),
    ).resolves.toBeNull();
    expect(await client.dailyLog.count()).toBe(dailyLogCount);
    expect(await client.dailyLogActivity.count()).toBe(dailyLogActivityCount);
    expect(
      await client.supplyRequestVersion.count({
        where: {
          supplyRequestId: result.supplyRequestId,
          changeKind: { in: ["FULFILLED", "CANCELLED", "CORRECTED"] },
        },
      }),
    ).toBe(0);
  });

  it("follows the current pointer instead of a higher or newer version fixture", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("pointer-authority", 1);
    const result = await createFromForm(6611, references);
    const original = await client.supplyRequestVersion.findUniqueOrThrow({
      where: { id: result.currentVersionId },
      include: { items: true },
    });
    await client.supplyRequestVersion.create({
      data: {
        id: `${references.prefix}-misleading-version`,
        supplyRequestId: result.supplyRequestId,
        versionNumber: 2,
        changeKind: "CORRECTED",
        status: "REQUESTED",
        operationalWorkDate: original.operationalWorkDate,
        submittedLocalDate: original.submittedLocalDate,
        submittedLocalTime: "23:59",
        equipmentId: original.equipmentId,
        equipmentDisplayNameSnapshot: "Misleading newer Equipment",
        equipmentNumberSnapshot: original.equipmentNumberSnapshot,
        equipmentCategorySnapshot: original.equipmentCategorySnapshot,
        mineNameSnapshot: original.mineNameSnapshot,
        cityNameSnapshot: original.cityNameSnapshot,
        cityStateSnapshot: original.cityStateSnapshot,
        requesterDisplayNameSnapshot: original.requesterDisplayNameSnapshot,
        requesterEmployeeNumberSnapshot:
          original.requesterEmployeeNumberSnapshot,
        supervisorId: original.supervisorId,
        supervisorNameSnapshot: original.supervisorNameSnapshot,
        supervisorEmailSnapshot: original.supervisorEmailSnapshot,
        notes: "This fixture must not become current.",
        correctionReason: "Controlled pointer-authority fixture",
        correctedByDisplayNameSnapshot: "Review fixture",
        correctionLocalDate: original.submittedLocalDate,
        correctionLocalTime: "23:59",
        createdAt: new Date(Date.now() + 60_000),
        items: {
          create: original.items.map((item) => ({
            id: `${references.prefix}-misleading-line-${item.sequence}`,
            supplyItemId: item.supplyItemId,
            sequence: item.sequence,
            quantity: item.quantity,
            itemNumberSnapshot: item.itemNumberSnapshot,
            normalizedItemNumberSnapshot: item.normalizedItemNumberSnapshot,
            descriptionSnapshot: item.descriptionSnapshot,
            unitOfMeasureSnapshot: item.unitOfMeasureSnapshot,
          })),
        },
      },
    });

    const current = await getCurrentSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
    );
    const immutableOriginal = await getOriginalSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
      "1",
    );
    expect(current).toMatchObject({
      versionId: result.currentVersionId,
      versionNumber: 1,
      equipmentLabel: expect.not.stringContaining("Misleading"),
      notes: "Corporate submission recorded.",
    });
    expect(immutableOriginal).toEqual(current);
  });

  it("returns only active bounded deterministic searchable options", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("options", supplyRequestOptionLimit + 2);
    await client.supplyItem.update({
      where: { id: references.items[0].id },
      data: { active: false },
    });
    await client.supplyRequestSupervisor.update({
      where: { id: references.supervisor.id },
      data: { active: false },
    });
    await client.equipment.update({
      where: { id: references.equipment.id },
      data: { status: "INACTIVE" },
    });
    const itemResults = await searchActiveSupplyRequestItemsWithClient(
      client,
      references.prefix,
    );
    expect(itemResults).toHaveLength(supplyRequestOptionLimit);
    expect(itemResults.some((item) => item.id === references.items[0].id)).toBe(
      false,
    );
    expect(itemResults.map((item) => item.itemNumber)).toEqual(
      [...itemResults.map((item) => item.itemNumber)].sort(),
    );
    expect(
      await searchActiveSupplyRequestSupervisorsWithClient(
        client,
        references.prefix,
      ),
    ).toEqual([]);
    expect(
      await searchActiveSupplyRequestEquipmentWithClient(
        client,
        references.prefix,
      ),
    ).toEqual([]);
  });

  it("rejects Equipment, supervisor, and item retirement races without allocation", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const cases = [
      {
        year: 6601,
        label: "inactive-equipment",
        retire: async (references: Awaited<ReturnType<typeof fixture>>) =>
          client.equipment.update({
            where: { id: references.equipment.id },
            data: { status: "INACTIVE" },
          }),
        discover: async (references: Awaited<ReturnType<typeof fixture>>) =>
          searchActiveSupplyRequestEquipmentWithClient(
            client,
            references.prefix,
          ),
        code: "EQUIPMENT_INACTIVE",
      },
      {
        year: 6602,
        label: "inactive-supervisor",
        retire: async (references: Awaited<ReturnType<typeof fixture>>) =>
          client.supplyRequestSupervisor.update({
            where: { id: references.supervisor.id },
            data: { active: false },
          }),
        discover: async (references: Awaited<ReturnType<typeof fixture>>) =>
          searchActiveSupplyRequestSupervisorsWithClient(
            client,
            references.prefix,
          ),
        code: "SUPERVISOR_INACTIVE",
      },
      {
        year: 6603,
        label: "inactive-item",
        retire: async (references: Awaited<ReturnType<typeof fixture>>) =>
          client.supplyItem.update({
            where: { id: references.items[0].id },
            data: { active: false },
          }),
        discover: async (references: Awaited<ReturnType<typeof fixture>>) =>
          searchActiveSupplyRequestItemsWithClient(client, references.prefix),
        code: "SUPPLY_ITEM_INACTIVE",
      },
    ] as const;

    for (const testCase of cases) {
      const references = await fixture(testCase.label, 1);
      expect((await testCase.discover(references)).length).toBe(1);
      await testCase.retire(references);
      await expect(createFromForm(testCase.year, references)).rejects.toMatchObject({
        name: "SupplyRequestCreateError",
        code: testCase.code,
      });
      expect(
        await client.supplyRequest.count({
          where: { referenceYear: testCase.year },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestReferenceCounter.count({
          where: { referenceYear: testCase.year },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestVersion.count({
          where: { supplyRequest: { referenceYear: testCase.year } },
        }),
      ).toBe(0);
      expect(
        await client.supplyRequestVersionItem.count({
          where: {
            version: { supplyRequest: { referenceYear: testCase.year } },
          },
        }),
      ).toBe(0);
    }
  });

  it("keeps current and original rendering snapshot-first after reference edits", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("snapshot", 1);
    const result = await createFromForm(6604, references);
    const before = await getCurrentSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
    );
    await client.supplyItem.update({
      where: { id: references.items[0].id },
      data: {
        itemNumber: `${references.prefix} changed`,
        normalizedItemNumber: `${references.prefix.toUpperCase()} CHANGED`,
        description: "Changed description",
        unitOfMeasure: "Changed unit",
        active: false,
      },
    });
    await client.supplyRequestSupervisor.update({
      where: { id: references.supervisor.id },
      data: {
        fullName: "Changed Supervisor",
        email: `${references.prefix}-changed@example.com`,
        normalizedEmail: `${references.prefix}-changed@example.com`,
        active: false,
      },
    });
    await client.equipment.update({
      where: { id: references.equipment.id },
      data: { displayName: `${references.prefix} Changed Equipment` },
    });
    await client.mine.update({
      where: { id: references.mine.id },
      data: { name: `${references.prefix} Changed Mine` },
    });
    await client.city.update({
      where: { id: references.city.id },
      data: { name: `${references.prefix} Changed City` },
    });
    const current = await getCurrentSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
    );
    const original = await getOriginalSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
      "1",
    );
    expect(current).toEqual(before);
    expect(original).toEqual(before);
  });

  it("keeps both detail boundaries readable after Equipment SetNull", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("set-null", 1);
    const result = await createFromForm(6605, references);
    await client.equipment.delete({ where: { id: references.equipment.id } });
    expect(
      await client.supplyRequest.count({
        where: { id: result.supplyRequestId },
      }),
    ).toBe(1);
    expect(
      await client.supplyRequestVersion.count({
        where: { supplyRequestId: result.supplyRequestId },
      }),
    ).toBe(1);
    expect(
      await client.supplyRequestVersionItem.count({
        where: { version: { supplyRequestId: result.supplyRequestId } },
      }),
    ).toBe(1);
    const current = await getCurrentSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
    );
    const original = await getOriginalSupplyRequestDetailWithClient(
      client,
      result.supplyRequestId,
      "1",
    );
    expect(current).toMatchObject({
      equipmentId: null,
      equipmentAvailable: false,
      mineName: references.mine.name,
      cityName: references.city.name,
      cityState: "WY",
    });
    expect(original).toEqual(current);
  });

  it("rejects malformed form payloads before persistence or counter allocation", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const references = await fixture("validation", 1);
    const invalidForms = [
      (() => {
        const data = formData(6612, references);
        data.delete("corporateSubmissionConfirmed");
        return data;
      })(),
      (() => {
        const data = formData(6613, references);
        data.set("itemsPayload", "[]");
        return data;
      })(),
      (() => {
        const data = formData(6614, references);
        data.set(
          "itemsPayload",
          JSON.stringify([
            { supplyItemId: references.items[0].id, quantity: 1 },
            { supplyItemId: references.items[0].id, quantity: 2 },
          ]),
        );
        return data;
      })(),
      (() => {
        const data = formData(6615, references);
        data.set("itemsPayload", "{bad");
        return data;
      })(),
      (() => {
        const data = formData(6616, references);
        data.set("submittedLocalTime", "24:00");
        return data;
      })(),
      (() => {
        const data = formData(6617, references);
        data.set("operationalWorkDate", "6617-02-30");
        return data;
      })(),
      (() => {
        const data = formData(6618, references);
        data.set("submittedLocalDate", "6618-13-01");
        return data;
      })(),
      (() => {
        const data = formData(6619, references);
        data.set(
          "itemsPayload",
          JSON.stringify([
            { supplyItemId: references.items[0].id, quantity: 0 },
          ]),
        );
        return data;
      })(),
      (() => {
        const data = formData(6619, references);
        data.set(
          "itemsPayload",
          JSON.stringify([
            {
              supplyItemId: references.items[0].id,
              quantity: 1,
              sequence: 1,
              unit: "Caller-owned",
            },
          ]),
        );
        return data;
      })(),
      (() => {
        const data = formData(6619, references);
        data.set("requesterDisplayNameSnapshot", "Caller-owned requester");
        return data;
      })(),
    ];
    for (const data of invalidForms) {
      expect(() => parseSupplyRequestCreateFormData(data)).toThrow(
        SupplyRequestCreateError,
      );
    }
    expect(
      await client.supplyRequest.count({
        where: {
          referenceYear: {
            in: [6612, 6613, 6614, 6615, 6616, 6617, 6618, 6619],
          },
        },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestReferenceCounter.count({
        where: {
          referenceYear: {
            in: [6612, 6613, 6614, 6615, 6616, 6617, 6618, 6619],
          },
        },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestVersion.count({
        where: {
          supplyRequest: {
            referenceYear: {
              in: [6612, 6613, 6614, 6615, 6616, 6617, 6618, 6619],
            },
          },
        },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestVersionItem.count({
        where: {
          version: {
            supplyRequest: {
              referenceYear: {
                in: [6612, 6613, 6614, 6615, 6616, 6617, 6618, 6619],
              },
            },
          },
        },
      }),
    ).toBe(0);
  });

  it("cleans all phase-owned application rows", async () => {
    await cleanPhaseData();
    expect(await phaseCounts()).toEqual({
      roots: 0,
      versions: 0,
      lines: 0,
      counters: 0,
    });
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    expect(
      await client.supplyItem.count({
        where: { normalizedItemNumber: { startsWith: normalizedTestPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestSupervisor.count({
        where: { normalizedEmail: { startsWith: testPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.equipment.count({
        where: { id: { startsWith: testPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.mine.count({
        where: { id: { startsWith: testPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.city.count({
        where: { id: { startsWith: testPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.dailyLog.count({
        where: { id: { startsWith: testPrefix } },
      }),
    ).toBe(0);
    expect(
      await client.dailyLogActivity.count({
        where: { id: { startsWith: testPrefix } },
      }),
    ).toBe(0);
  });
});
