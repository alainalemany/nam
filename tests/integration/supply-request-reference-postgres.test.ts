import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SupplyRequestCreateError } from "@/features/supply-requests/errors";
import { createSupplyRequestWithDependencies } from "@/features/supply-requests/persistence-internal";
import { SupplyRequestReferenceError } from "@/features/supply-requests/reference-errors";
import {
  createSupervisorReferenceWithClient,
  createSupplyItemReferenceWithClient,
  setSupervisorStatusWithClient,
  setSupplyItemStatusWithClient,
  updateSupervisorReferenceWithClient,
  updateSupplyItemReferenceWithClient,
} from "@/features/supply-requests/reference-persistence-internal";

const expectedTestDatabaseName = "nam_supply_request_test";
const testPrefix = "supply-reference-";
const normalizedTestPrefix = testPrefix.toUpperCase();
const reservedYears = Array.from({ length: 20 }, (_, index) => 6400 + index);

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
      `Supply Requests PostgreSQL tests require the disposable ${expectedTestDatabaseName} database.`,
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

async function createLocationReferences(label: string) {
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
      displayName: "Dragline 101133",
      equipmentNumber: "101133",
      category: "DRAGLINE",
    },
  });
  return { prefix, city, mine, equipment };
}

function validRequestInput(
  year: number,
  equipmentId: string,
  supervisorId: string,
  supplyItemId: string,
) {
  return {
    operationalWorkDate: `${year}-07-28`,
    submittedLocalDate: `${year}-07-29`,
    submittedLocalTime: "01:15",
    equipmentId,
    supervisorId,
    corporateSubmissionConfirmed: true,
    items: [{ supplyItemId, quantity: 2 }],
  };
}

async function expectReferenceError(
  promise: Promise<unknown>,
  code: SupplyRequestReferenceError["code"],
) {
  await expect(promise).rejects.toMatchObject({
    name: "SupplyRequestReferenceError",
    code,
  });
}

async function aggregateCounts() {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  return {
    requests: await client.supplyRequest.count({
      where: { referenceYear: { in: reservedYears } },
    }),
    versions: await client.supplyRequestVersion.count({
      where: { supplyRequest: { referenceYear: { in: reservedYears } } },
    }),
    versionItems: await client.supplyRequestVersionItem.count({
      where: {
        version: {
          supplyRequest: { referenceYear: { in: reservedYears } },
        },
      },
    }),
    counters: await client.supplyRequestReferenceCounter.count({
      where: { referenceYear: { in: reservedYears } },
    }),
  };
}

const emptyAggregateCounts = {
  requests: 0,
  versions: 0,
  versionItems: 0,
  counters: 0,
};

describePostgres("Supply Request reference-management PostgreSQL behavior", () => {
  beforeAll(async () => {
    await cleanPhaseData();
  });

  afterAll(async () => {
    await cleanPhaseData();
    await client?.$disconnect();
  });

  it("creates normalized active references and permits same-name supervisors", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const label = uniqueLabel("create");
    const item = await createSupplyItemReferenceWithClient(client, {
      itemNumber: `  ${label}\tA-10  `,
      description: "  Shop   towels  ",
      unitOfMeasure: "  Case  ",
    });
    const first = await createSupervisorReferenceWithClient(client, {
      fullName: "  Pablo   Gonzalez  ",
      email: `  ${label}@Example.com  `,
    });
    const second = await createSupervisorReferenceWithClient(client, {
      fullName: "Pablo Gonzalez",
      email: `${label}-second@example.com`,
    });

    await expect(
      client.supplyItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({
      itemNumber: `${label} A-10`,
      normalizedItemNumber: `${label.toUpperCase()} A-10`,
      description: "Shop towels",
      unitOfMeasure: "Case",
      active: true,
    });
    await expect(
      client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: first.id },
      }),
    ).resolves.toMatchObject({
      fullName: "Pablo Gonzalez",
      email: `${label}@Example.com`,
      normalizedEmail: `${label}@example.com`,
      active: true,
    });
    expect(first.id).not.toBe(second.id);
    expect(await aggregateCounts()).toEqual(emptyAggregateCounts);
  });

  it("maps sequential and genuinely concurrent normalized-key conflicts", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const itemLabel = uniqueLabel("duplicate-item");
    const itemInput = {
      itemNumber: `${itemLabel}-01`,
      description: "Absorbent",
      unitOfMeasure: "Each",
    };
    await createSupplyItemReferenceWithClient(client, itemInput);
    await expectReferenceError(
      createSupplyItemReferenceWithClient(client, {
        ...itemInput,
        itemNumber: itemInput.itemNumber.toLowerCase(),
      }),
      "DUPLICATE_ITEM_NUMBER",
    );

    const concurrentItemLabel = uniqueLabel("concurrent-item");
    const itemResults = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createSupplyItemReferenceWithClient(client, {
          itemNumber: concurrentItemLabel,
          description: "Concurrent item",
          unitOfMeasure: "Each",
        }),
      ),
    );
    expect(itemResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      itemResults
        .filter((result) => result.status === "rejected")
        .every(
          (result) =>
            result.reason instanceof SupplyRequestReferenceError &&
            result.reason.code === "DUPLICATE_ITEM_NUMBER",
        ),
    ).toBe(true);
    expect(
      await client.supplyItem.count({
        where: {
          normalizedItemNumber: concurrentItemLabel.toUpperCase(),
        },
      }),
    ).toBe(1);

    const emailLabel = uniqueLabel("duplicate-email");
    const supervisorInput = {
      fullName: "Alex Supervisor",
      email: `${emailLabel}@Example.com`,
    };
    await createSupervisorReferenceWithClient(client, supervisorInput);
    await expectReferenceError(
      createSupervisorReferenceWithClient(client, {
        ...supervisorInput,
        email: `${emailLabel}@example.com`,
      }),
      "DUPLICATE_SUPERVISOR_EMAIL",
    );

    const concurrentEmail = `${uniqueLabel("concurrent-email")}@example.com`;
    const supervisorResults = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        createSupervisorReferenceWithClient(client, {
          fullName: `Concurrent Supervisor ${index}`,
          email: concurrentEmail,
        }),
      ),
    );
    expect(
      supervisorResults.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      supervisorResults
        .filter((result) => result.status === "rejected")
        .every(
          (result) =>
            result.reason instanceof SupplyRequestReferenceError &&
            result.reason.code === "DUPLICATE_SUPERVISOR_EMAIL",
        ),
    ).toBe(true);
    expect(
      await client.supplyRequestSupervisor.count({
        where: { normalizedEmail: concurrentEmail },
      }),
    ).toBe(1);
    expect(await aggregateCounts()).toEqual(emptyAggregateCounts);
  });

  it("recalculates identities on edit and safely rejects edit collisions", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const label = uniqueLabel("edit");
    const itemOne = await createSupplyItemReferenceWithClient(client, {
      itemNumber: `${label}-ONE`,
      description: "Original",
      unitOfMeasure: "Each",
    });
    const itemTwo = await createSupplyItemReferenceWithClient(client, {
      itemNumber: `${label}-TWO`,
      description: "Other",
      unitOfMeasure: "Box",
    });
    await updateSupplyItemReferenceWithClient(client, itemOne.id, {
      itemNumber: ` ${label}-one-edited `,
      description: " Edited   description ",
      unitOfMeasure: " Case ",
    });
    await expect(
      client.supplyItem.findUniqueOrThrow({ where: { id: itemOne.id } }),
    ).resolves.toMatchObject({
      itemNumber: `${label}-one-edited`,
      normalizedItemNumber: `${label.toUpperCase()}-ONE-EDITED`,
      description: "Edited description",
      unitOfMeasure: "Case",
    });
    await expectReferenceError(
      updateSupplyItemReferenceWithClient(client, itemTwo.id, {
        itemNumber: `${label}-ONE-EDITED`,
        description: "Collision",
        unitOfMeasure: "Each",
      }),
      "DUPLICATE_ITEM_NUMBER",
    );
    await expect(
      client.supplyItem.findUniqueOrThrow({ where: { id: itemTwo.id } }),
    ).resolves.toMatchObject({
      itemNumber: `${label}-TWO`,
      normalizedItemNumber: `${label.toUpperCase()}-TWO`,
      description: "Other",
      unitOfMeasure: "Box",
      active: true,
    });

    const supervisorOne = await createSupervisorReferenceWithClient(client, {
      fullName: "First Supervisor",
      email: `${label}-one@example.com`,
    });
    const supervisorTwo = await createSupervisorReferenceWithClient(client, {
      fullName: "Second Supervisor",
      email: `${label}-two@example.com`,
    });
    await updateSupervisorReferenceWithClient(client, supervisorOne.id, {
      fullName: " Updated   Supervisor ",
      email: ` ${label}-updated@Example.com `,
    });
    await expect(
      client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: supervisorOne.id },
      }),
    ).resolves.toMatchObject({
      fullName: "Updated Supervisor",
      email: `${label}-updated@Example.com`,
      normalizedEmail: `${label}-updated@example.com`,
    });
    await expectReferenceError(
      updateSupervisorReferenceWithClient(client, supervisorTwo.id, {
        fullName: "Collision",
        email: `${label}-updated@example.com`,
      }),
      "DUPLICATE_SUPERVISOR_EMAIL",
    );
    await expect(
      client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: supervisorTwo.id },
      }),
    ).resolves.toMatchObject({
      fullName: "Second Supervisor",
      email: `${label}-two@example.com`,
      normalizedEmail: `${label}-two@example.com`,
      active: true,
    });
    expect(await aggregateCounts()).toEqual(emptyAggregateCounts);
  });

  it("activates and inactivates references idempotently without creating requests", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const label = uniqueLabel("status");
    const item = await createSupplyItemReferenceWithClient(client, {
      itemNumber: label,
      description: "Status item",
      unitOfMeasure: "Each",
    });
    const supervisor = await createSupervisorReferenceWithClient(client, {
      fullName: "Status Supervisor",
      email: `${label}@example.com`,
    });

    await setSupplyItemStatusWithClient(client, item.id, "inactivate");
    await setSupplyItemStatusWithClient(client, item.id, "inactivate");
    await setSupervisorStatusWithClient(client, supervisor.id, "inactivate");
    await setSupervisorStatusWithClient(client, supervisor.id, "inactivate");
    expect(
      await client.supplyItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({ active: false });
    expect(
      await client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: supervisor.id },
      }),
    ).toMatchObject({ active: false });

    await setSupplyItemStatusWithClient(client, item.id, "activate");
    await setSupervisorStatusWithClient(client, supervisor.id, "activate");
    expect(
      await client.supplyItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).toMatchObject({ active: true });
    expect(
      await client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: supervisor.id },
      }),
    ).toMatchObject({ active: true });
    expect(await aggregateCounts()).toEqual(emptyAggregateCounts);
  });

  it("preserves accepted request snapshots while used references are edited and retired", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const year = 6400;
    const references = await createLocationReferences("history");
    const item = await createSupplyItemReferenceWithClient(client, {
      itemNumber: `${references.prefix}-OLD`,
      description: "Original description",
      unitOfMeasure: "Original unit",
    });
    const supervisor = await createSupervisorReferenceWithClient(client, {
      fullName: "Original Supervisor",
      email: `${references.prefix}@Example.com`,
    });
    const request = await createSupplyRequestWithDependencies(
      validRequestInput(
        year,
        references.equipment.id,
        supervisor.id,
        item.id,
      ),
      { client },
    );
    const versionBeforeManagement =
      await client.supplyRequestVersion.findUniqueOrThrow({
        where: { id: request.currentVersionId },
        select: {
          supervisorNameSnapshot: true,
          supervisorEmailSnapshot: true,
          items: {
            select: {
              id: true,
              sequence: true,
              quantity: true,
              itemNumberSnapshot: true,
              normalizedItemNumberSnapshot: true,
              descriptionSnapshot: true,
              unitOfMeasureSnapshot: true,
            },
            orderBy: { sequence: "asc" },
          },
        },
      });
    const aggregateCountsBeforeManagement = await aggregateCounts();

    await updateSupplyItemReferenceWithClient(client, item.id, {
      itemNumber: `${references.prefix}-NEW`,
      description: "Current description",
      unitOfMeasure: "Current unit",
    });
    await updateSupervisorReferenceWithClient(client, supervisor.id, {
      fullName: "Current Supervisor",
      email: `${references.prefix}-current@example.com`,
    });
    await setSupplyItemStatusWithClient(client, item.id, "inactivate");
    await setSupervisorStatusWithClient(client, supervisor.id, "inactivate");

    const versionAfterManagement =
      await client.supplyRequestVersion.findUniqueOrThrow({
        where: { id: request.currentVersionId },
        select: {
          supervisorNameSnapshot: true,
          supervisorEmailSnapshot: true,
          items: {
            select: {
              id: true,
              sequence: true,
              quantity: true,
              itemNumberSnapshot: true,
              normalizedItemNumberSnapshot: true,
              descriptionSnapshot: true,
              unitOfMeasureSnapshot: true,
            },
            orderBy: { sequence: "asc" },
          },
        },
      });
    expect(versionAfterManagement).toEqual(versionBeforeManagement);
    expect(await aggregateCounts()).toEqual(aggregateCountsBeforeManagement);
    await expect(
      client.supplyItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({
      itemNumber: `${references.prefix}-NEW`,
      description: "Current description",
      unitOfMeasure: "Current unit",
      active: false,
    });
    await expect(
      client.supplyRequestSupervisor.findUniqueOrThrow({
        where: { id: supervisor.id },
      }),
    ).resolves.toMatchObject({
      fullName: "Current Supervisor",
      email: `${references.prefix}-current@example.com`,
      active: false,
    });

    const version = await client.supplyRequestVersion.findUniqueOrThrow({
      where: { id: request.currentVersionId },
      include: { items: true },
    });
    expect(version).toMatchObject({
      supervisorNameSnapshot: "Original Supervisor",
      supervisorEmailSnapshot: `${references.prefix}@Example.com`,
    });
    expect(version.items[0]).toMatchObject({
      itemNumberSnapshot: `${references.prefix}-OLD`,
      normalizedItemNumberSnapshot: `${references.prefix.toUpperCase()}-OLD`,
      descriptionSnapshot: "Original description",
      unitOfMeasureSnapshot: "Original unit",
    });
    await expect(
      client.supplyItem.delete({ where: { id: item.id } }),
    ).rejects.toThrow("SupplyRequestVersionItem_supplyItem_fkey");
    await expect(
      client.supplyRequestSupervisor.delete({ where: { id: supervisor.id } }),
    ).rejects.toThrow("SupplyRequestVersion_supervisor_fkey");
    expect(
      await client.supplyRequest.findUnique({ where: { id: request.supplyRequestId } }),
    ).not.toBeNull();

    await expect(
      createSupplyRequestWithDependencies(
        validRequestInput(
          6401,
          references.equipment.id,
          supervisor.id,
          item.id,
        ),
        { client },
      ),
    ).rejects.toMatchObject({
      name: "SupplyRequestCreateError",
      code: "SUPERVISOR_INACTIVE",
    } satisfies Partial<SupplyRequestCreateError>);
    expect(
      await client.supplyRequest.count({ where: { referenceYear: 6401 } }),
    ).toBe(0);
    expect(
      await client.supplyRequestReferenceCounter.findUnique({
        where: { referenceYear: 6401 },
      }),
    ).toBeNull();
    expect(await aggregateCounts()).toEqual(aggregateCountsBeforeManagement);

    await setSupervisorStatusWithClient(client, supervisor.id, "activate");
    await expect(
      createSupplyRequestWithDependencies(
        validRequestInput(
          6401,
          references.equipment.id,
          supervisor.id,
          item.id,
        ),
        { client },
      ),
    ).rejects.toMatchObject({
      name: "SupplyRequestCreateError",
      code: "SUPPLY_ITEM_INACTIVE",
    } satisfies Partial<SupplyRequestCreateError>);
    expect(await aggregateCounts()).toEqual(aggregateCountsBeforeManagement);
    await setSupplyItemStatusWithClient(client, item.id, "activate");
    await expect(
      createSupplyRequestWithDependencies(
        validRequestInput(
          6401,
          references.equipment.id,
          supervisor.id,
          item.id,
        ),
        { client },
      ),
    ).resolves.toMatchObject({
      namReference: "SR-6401-0001",
      status: "REQUESTED",
    });
    expect(await aggregateCounts()).toEqual({
      requests: 2,
      versions: 2,
      versionItems: 2,
      counters: 2,
    });
  });

  it("leaves no phase-owned rows after explicit cleanup", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    await cleanPhaseData();
    expect(
      await client.supplyRequest.count({
        where: { referenceYear: { in: reservedYears } },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestVersion.count({
        where: { supplyRequest: { referenceYear: { in: reservedYears } } },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestVersionItem.count({
        where: {
          version: {
            supplyRequest: { referenceYear: { in: reservedYears } },
          },
        },
      }),
    ).toBe(0);
    expect(
      await client.supplyRequestReferenceCounter.count({
        where: { referenceYear: { in: reservedYears } },
      }),
    ).toBe(0);
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
  });
});
