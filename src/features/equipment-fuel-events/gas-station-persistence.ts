import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { GasStationSubmissionInput } from "./gas-station-validation";
import { normalizeFuelDisplayText, normalizeFuelReference } from "./validation";

export class GasStationPersistenceError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export function gasStationNormalizedKey(input: {
  name: string;
  address?: string | null;
  cityId: string;
  postalCode?: string | null;
}) {
  return [input.name, input.address ?? "", input.cityId, input.postalCode ?? ""]
    .map(normalizeFuelReference)
    .join("|");
}

function stationData(input: GasStationSubmissionInput) {
  const name = normalizeFuelDisplayText(input.name);
  const address = input.address ? normalizeFuelDisplayText(input.address) : null;
  const postalCode = input.postalCode ? normalizeFuelDisplayText(input.postalCode) : null;
  return {
    name,
    address,
    cityId: input.cityId,
    postalCode,
    normalizedKey: gasStationNormalizedKey({
      name,
      address,
      cityId: input.cityId,
      postalCode,
    }),
  };
}

function mapError(error: unknown): never {
  if (error instanceof GasStationPersistenceError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new GasStationPersistenceError(
        "A Gas Station with the same name and location already exists.",
        "name",
      );
    }
    if (error.code === "P2025") {
      throw new GasStationPersistenceError("Gas Station could not be found.");
    }
  }
  throw error;
}

export async function saveGasStation(input: GasStationSubmissionInput, id?: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = id
        ? await transaction.gasStation.findUnique({ where: { id }, select: { cityId: true } })
        : null;
      if (id && !existing) throw new GasStationPersistenceError("Gas Station could not be found.");

      const city = await transaction.city.findUnique({
        where: { id: input.cityId },
        select: { id: true, status: true },
      });
      if (!city) throw new GasStationPersistenceError("The selected City could not be found.", "cityId");
      if ((!existing || existing.cityId !== city.id) && city.status !== "ACTIVE") {
        throw new GasStationPersistenceError("Select an active City.", "cityId");
      }

      const data = stationData(input);
      return existing
        ? transaction.gasStation.update({ where: { id }, data })
        : transaction.gasStation.create({ data: { ...data, isActive: true } });
    });
  } catch (error) {
    mapError(error);
  }
}

export async function setGasStationActive(id: string, isActive: boolean) {
  try {
    return await prisma.gasStation.update({ where: { id }, data: { isActive } });
  } catch (error) {
    mapError(error);
  }
}
