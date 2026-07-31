import { prisma } from "@/lib/prisma";

import {
  correctSupplyRequestWithDependencies,
  type CorrectSupplyRequestResult,
} from "./correction-persistence-internal";
import type { CorrectSupplyRequestInput } from "./correction-validation";

export type { CorrectSupplyRequestResult };

export function correctSupplyRequest(
  input: CorrectSupplyRequestInput,
): Promise<CorrectSupplyRequestResult> {
  return correctSupplyRequestWithDependencies(input, { client: prisma });
}
