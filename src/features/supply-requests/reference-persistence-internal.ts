import { Prisma, type PrismaClient } from "@prisma/client";

import {
  SupplyRequestReferenceError,
  unexpectedSupplyRequestReferenceError,
} from "./reference-errors";
import {
  parseReferenceId,
  parseReferenceStatusIntent,
  parseSupervisorReferenceInput,
  parseSupplyItemReferenceInput,
} from "./reference-validation";

function targetMatches(target: unknown, constraint: string, field: string) {
  return (
    target === constraint ||
    (Array.isArray(target) && target.length === 1 && target[0] === field)
  );
}

function mapPersistenceError(
  error: unknown,
  kind: "item" | "supervisor",
): never {
  if (error instanceof SupplyRequestReferenceError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new SupplyRequestReferenceError(
        "NOT_FOUND",
        "The requested reference record could not be found.",
      );
    }
    if (
      error.code === "P2002" &&
      kind === "item" &&
      targetMatches(
        error.meta?.target,
        "SupplyItem_normalizedItemNumber_key",
        "normalizedItemNumber",
      )
    ) {
      throw new SupplyRequestReferenceError(
        "DUPLICATE_ITEM_NUMBER",
        "A Supply Item with this Item Number already exists.",
        "itemNumber",
        { itemNumber: ["A Supply Item with this Item Number already exists."] },
      );
    }
    if (
      error.code === "P2002" &&
      kind === "supervisor" &&
      targetMatches(
        error.meta?.target,
        "SupplyRequestSupervisor_normalizedEmail_key",
        "normalizedEmail",
      )
    ) {
      throw new SupplyRequestReferenceError(
        "DUPLICATE_SUPERVISOR_EMAIL",
        "A supervisor with this email already exists.",
        "email",
        { email: ["A supervisor with this email already exists."] },
      );
    }
  }
  throw unexpectedSupplyRequestReferenceError();
}

async function requireSupplyItem(client: PrismaClient, id: string) {
  const record = await client.supplyItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!record) {
    throw new SupplyRequestReferenceError(
      "NOT_FOUND",
      "The requested Supply Item could not be found.",
    );
  }
}

async function requireSupervisor(client: PrismaClient, id: string) {
  const record = await client.supplyRequestSupervisor.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!record) {
    throw new SupplyRequestReferenceError(
      "NOT_FOUND",
      "The requested supervisor could not be found.",
    );
  }
}

export async function createSupplyItemReferenceWithClient(
  client: PrismaClient,
  input: unknown,
) {
  const parsed = parseSupplyItemReferenceInput(input);
  try {
    return await client.supplyItem.create({
      data: { ...parsed, active: true },
      select: { id: true },
    });
  } catch (error) {
    mapPersistenceError(error, "item");
  }
}

export async function updateSupplyItemReferenceWithClient(
  client: PrismaClient,
  idInput: unknown,
  input: unknown,
) {
  const id = parseReferenceId(idInput);
  const parsed = parseSupplyItemReferenceInput(input);
  await requireSupplyItem(client, id);
  try {
    return await client.supplyItem.update({
      where: { id },
      data: parsed,
      select: { id: true },
    });
  } catch (error) {
    mapPersistenceError(error, "item");
  }
}

export async function setSupplyItemStatusWithClient(
  client: PrismaClient,
  idInput: unknown,
  intentInput: unknown,
) {
  const id = parseReferenceId(idInput);
  const intent = parseReferenceStatusIntent(intentInput);
  await requireSupplyItem(client, id);
  try {
    return await client.supplyItem.update({
      where: { id },
      data: { active: intent === "activate" },
      select: { id: true, active: true },
    });
  } catch (error) {
    mapPersistenceError(error, "item");
  }
}

export async function createSupervisorReferenceWithClient(
  client: PrismaClient,
  input: unknown,
) {
  const parsed = parseSupervisorReferenceInput(input);
  try {
    return await client.supplyRequestSupervisor.create({
      data: { ...parsed, active: true },
      select: { id: true },
    });
  } catch (error) {
    mapPersistenceError(error, "supervisor");
  }
}

export async function updateSupervisorReferenceWithClient(
  client: PrismaClient,
  idInput: unknown,
  input: unknown,
) {
  const id = parseReferenceId(idInput);
  const parsed = parseSupervisorReferenceInput(input);
  await requireSupervisor(client, id);
  try {
    return await client.supplyRequestSupervisor.update({
      where: { id },
      data: parsed,
      select: { id: true },
    });
  } catch (error) {
    mapPersistenceError(error, "supervisor");
  }
}

export async function setSupervisorStatusWithClient(
  client: PrismaClient,
  idInput: unknown,
  intentInput: unknown,
) {
  const id = parseReferenceId(idInput);
  const intent = parseReferenceStatusIntent(intentInput);
  await requireSupervisor(client, id);
  try {
    return await client.supplyRequestSupervisor.update({
      where: { id },
      data: { active: intent === "activate" },
      select: { id: true, active: true },
    });
  } catch (error) {
    mapPersistenceError(error, "supervisor");
  }
}
