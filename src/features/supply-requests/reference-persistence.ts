import { prisma } from "@/lib/prisma";

import {
  createSupervisorReferenceWithClient,
  createSupplyItemReferenceWithClient,
  setSupervisorStatusWithClient,
  setSupplyItemStatusWithClient,
  updateSupervisorReferenceWithClient,
  updateSupplyItemReferenceWithClient,
} from "./reference-persistence-internal";

export function createSupplyItemReference(input: unknown) {
  return createSupplyItemReferenceWithClient(prisma, input);
}

export function updateSupplyItemReference(id: unknown, input: unknown) {
  return updateSupplyItemReferenceWithClient(prisma, id, input);
}

export function setSupplyItemStatus(id: unknown, intent: unknown) {
  return setSupplyItemStatusWithClient(prisma, id, intent);
}

export function createSupervisorReference(input: unknown) {
  return createSupervisorReferenceWithClient(prisma, input);
}

export function updateSupervisorReference(id: unknown, input: unknown) {
  return updateSupervisorReferenceWithClient(prisma, id, input);
}

export function setSupervisorStatus(id: unknown, intent: unknown) {
  return setSupervisorStatusWithClient(prisma, id, intent);
}
