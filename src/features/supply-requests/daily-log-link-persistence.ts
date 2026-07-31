import { prisma } from "@/lib/prisma";

import {
  removeSupplyRequestDailyLogLinkWithDependencies,
  setSupplyRequestDailyLogLinkWithDependencies,
  type RemoveSupplyRequestDailyLogLinkResult,
  type SetSupplyRequestDailyLogLinkResult,
} from "./daily-log-link-persistence-internal";
import type {
  RemoveSupplyRequestDailyLogLinkInput,
  SetSupplyRequestDailyLogLinkInput,
} from "./daily-log-link-validation";

export type {
  RemoveSupplyRequestDailyLogLinkResult,
  SetSupplyRequestDailyLogLinkResult,
};

export function setSupplyRequestDailyLogLink(
  input: SetSupplyRequestDailyLogLinkInput,
) {
  return setSupplyRequestDailyLogLinkWithDependencies(input, { client: prisma });
}

export function removeSupplyRequestDailyLogLink(
  input: RemoveSupplyRequestDailyLogLinkInput,
) {
  return removeSupplyRequestDailyLogLinkWithDependencies(input, {
    client: prisma,
  });
}
