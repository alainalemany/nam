import { prisma } from "@/lib/prisma";

import {
  createSupplyRequestWithDependencies,
  formatSupplyRequestNamReference,
  type CreateSupplyRequestResult,
} from "./persistence-internal";
import type { CreateSupplyRequestInput } from "./validation";

export { formatSupplyRequestNamReference };
export type { CreateSupplyRequestResult };

/**
 * Records one already-submitted corporate Supply Request as an initial NAM
 * aggregate. Runtime validation and every integrity-sensitive dependency remain
 * inside the feature-owned persistence boundary.
 */
export function createSupplyRequest(
  input: CreateSupplyRequestInput,
): Promise<CreateSupplyRequestResult> {
  return createSupplyRequestWithDependencies(input, { client: prisma });
}
