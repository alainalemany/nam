import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { normalizeGeographyKey } from "./normalization";
import type { CitySubmissionInput, StateSubmissionInput } from "./validation";

export class GeographyPersistenceError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
  }
}

function mapError(error: unknown): never {
  if (error instanceof GeographyPersistenceError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new GeographyPersistenceError("A matching reference record already exists.", "name");
    }
    if (error.code === "P2025") throw new GeographyPersistenceError("Reference record could not be found.");
  }
  throw error;
}

export async function saveState(input: StateSubmissionInput, id?: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = id
        ? await transaction.state.findUnique({ where: { id }, select: { id: true, abbreviation: true } })
        : null;
      if (id && !existing) throw new GeographyPersistenceError("State could not be found.");
      const data = {
        name: input.name,
        abbreviation: input.abbreviation,
        normalizedKey: normalizeGeographyKey(input.name),
      };
      if (!existing) return transaction.state.create({ data: { ...data, status: "ACTIVE" } });
      const state = await transaction.state.update({ where: { id }, data });
      if (existing.abbreviation !== input.abbreviation) {
        await transaction.city.updateMany({ where: { stateId: id }, data: { state: input.abbreviation } });
      }
      return state;
    });
  } catch (error) {
    mapError(error);
  }
}

export async function saveCity(input: CitySubmissionInput, id?: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = id
        ? await transaction.city.findUnique({ where: { id }, select: { id: true, stateId: true } })
        : null;
      if (id && !existing) throw new GeographyPersistenceError("City could not be found.");
      const state = await transaction.state.findUnique({
        where: { id: input.stateId },
        select: { id: true, abbreviation: true, status: true },
      });
      if (!state) throw new GeographyPersistenceError("The selected State could not be found.", "stateId");
      if (state.status !== "ACTIVE" && existing?.stateId !== state.id) {
        throw new GeographyPersistenceError("Select an active State.", "stateId");
      }
      const data = {
        name: input.name,
        stateId: state.id,
        state: state.abbreviation,
        normalizedKey: normalizeGeographyKey(input.name),
      };
      return existing
        ? transaction.city.update({ where: { id }, data })
        : transaction.city.create({ data: { ...data, status: "ACTIVE" } });
    });
  } catch (error) {
    mapError(error);
  }
}

export async function setStateStatus(id: string, active: boolean) {
  try {
    return await prisma.state.update({ where: { id }, data: { status: active ? "ACTIVE" : "INACTIVE" } });
  } catch (error) {
    mapError(error);
  }
}

export async function setCityStatus(id: string, active: boolean) {
  try {
    return await prisma.city.update({ where: { id }, data: { status: active ? "ACTIVE" : "INACTIVE" } });
  } catch (error) {
    mapError(error);
  }
}
