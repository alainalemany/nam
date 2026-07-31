import { prisma } from "@/lib/prisma";

import {
  getCurrentSupplyRequestDetailWithClient,
  getImmutableSupplyRequestVersionWithClient,
  getOriginalSupplyRequestDetailWithClient,
  getSupplyRequestCorrectionContextWithClient,
  getSupplyRequestCorrectionHistoryWithClient,
  getSupplyRequestCurrentPageDataWithClient,
  getSupplyRequestLifecycleActionContextWithClient,
  getSupplyRequestCreatePageDataWithClient,
  searchActiveSupplyRequestEquipmentWithClient,
  searchActiveSupplyRequestItemsWithClient,
  searchActiveSupplyRequestSupervisorsWithClient,
} from "./surface-data-internal";

export async function getSupplyRequestCreatePageData() {
  try {
    return await getSupplyRequestCreatePageDataWithClient(prisma);
  } catch {
    return {
      equipment: [],
      supervisors: [],
      items: [],
      hasActiveEquipment: false,
      hasActiveSupervisors: false,
      hasActiveItems: false,
      loadError:
        "Supply Request references could not be loaded. Try again before recording this request in NAM.",
    } as const;
  }
}

export async function searchActiveSupplyRequestEquipment(input: unknown) {
  return searchActiveSupplyRequestEquipmentWithClient(prisma, input);
}

export async function searchActiveSupplyRequestSupervisors(input: unknown) {
  return searchActiveSupplyRequestSupervisorsWithClient(prisma, input);
}

export async function searchActiveSupplyRequestItems(input: unknown) {
  return searchActiveSupplyRequestItemsWithClient(prisma, input);
}

export async function getCurrentSupplyRequestDetail(id: unknown) {
  return getCurrentSupplyRequestDetailWithClient(prisma, id);
}

export async function getSupplyRequestCurrentPageData(id: unknown) {
  return getSupplyRequestCurrentPageDataWithClient(prisma, id);
}

export async function getOriginalSupplyRequestDetail(
  id: unknown,
  version: unknown,
) {
  return getOriginalSupplyRequestDetailWithClient(prisma, id, version);
}

export async function getImmutableSupplyRequestVersion(
  id: unknown,
  version: unknown,
) {
  return getImmutableSupplyRequestVersionWithClient(prisma, id, version);
}

export async function getSupplyRequestCorrectionHistory(id: unknown) {
  return getSupplyRequestCorrectionHistoryWithClient(prisma, id);
}

export async function getSupplyRequestCorrectionContext(id: unknown) {
  return getSupplyRequestCorrectionContextWithClient(prisma, id);
}

export async function getSupplyRequestLifecycleActionContext(id: unknown) {
  return getSupplyRequestLifecycleActionContextWithClient(prisma, id);
}
