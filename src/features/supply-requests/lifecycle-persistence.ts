import { prisma } from "@/lib/prisma";

import {
  cancelSupplyRequestWithDependencies,
  fulfillSupplyRequestWithDependencies,
  type CancelSupplyRequestResult,
  type FulfillSupplyRequestResult,
} from "./lifecycle-persistence-internal";
import type {
  CancelSupplyRequestInput,
  FulfillSupplyRequestInput,
} from "./lifecycle-validation";

export type { CancelSupplyRequestResult, FulfillSupplyRequestResult };

export function fulfillSupplyRequest(
  input: FulfillSupplyRequestInput,
): Promise<FulfillSupplyRequestResult> {
  return fulfillSupplyRequestWithDependencies(input, { client: prisma });
}

export function cancelSupplyRequest(
  input: CancelSupplyRequestInput,
): Promise<CancelSupplyRequestResult> {
  return cancelSupplyRequestWithDependencies(input, { client: prisma });
}
