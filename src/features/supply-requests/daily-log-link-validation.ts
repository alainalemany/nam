import { z } from "zod";

import { supplyRequestMaximumIdentifierLength } from "./constants";
import { SupplyRequestDailyLogLinkError } from "./daily-log-link-errors";
import {
  supplyRequestDailyLogRoles,
  type SupplyRequestDailyLogRoleValue,
} from "./daily-log-link-types";
import { supplyRequestEquipmentSnapshotLabel } from "./surface-display";
import { isCanonicalSupplyRequestDate } from "./validation";

const identifier = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(
      supplyRequestMaximumIdentifierLength,
      `${label} must be ${supplyRequestMaximumIdentifierLength} characters or fewer.`,
    );

const role = z.enum(supplyRequestDailyLogRoles, {
  error: "Choose a valid Daily Log link role.",
});

export const setSupplyRequestDailyLogLinkInputSchema = z
  .object({
    supplyRequestId: identifier("Supply Request"),
    role,
    dailyLogActivityId: identifier("Daily Log Activity"),
    expectedDailyLogActivityId: identifier("Expected Daily Log Activity").optional(),
  })
  .strict();

export const removeSupplyRequestDailyLogLinkInputSchema = z
  .object({
    supplyRequestId: identifier("Supply Request"),
    role,
    expectedDailyLogActivityId: identifier("Expected Daily Log Activity"),
  })
  .strict();

export type SetSupplyRequestDailyLogLinkInput = z.input<
  typeof setSupplyRequestDailyLogLinkInputSchema
>;
export type ValidatedSetSupplyRequestDailyLogLinkInput = z.output<
  typeof setSupplyRequestDailyLogLinkInputSchema
>;
export type RemoveSupplyRequestDailyLogLinkInput = z.input<
  typeof removeSupplyRequestDailyLogLinkInputSchema
>;
export type ValidatedRemoveSupplyRequestDailyLogLinkInput = z.output<
  typeof removeSupplyRequestDailyLogLinkInputSchema
>;

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join(".") || "form";
    (errors[field] ??= []).push(issue.message);
  }
  throw new SupplyRequestDailyLogLinkError(
    "INVALID_INPUT",
    "Check the Daily Log link details and try again.",
    undefined,
    errors,
  );
}

export function parseSetSupplyRequestDailyLogLinkInput(input: unknown) {
  return parseOrThrow(setSupplyRequestDailyLogLinkInputSchema, input);
}

export function parseRemoveSupplyRequestDailyLogLinkInput(input: unknown) {
  return parseOrThrow(removeSupplyRequestDailyLogLinkInputSchema, input);
}

export type SupplyRequestDailyLogAggregateFacts = Readonly<{
  namReference: string;
  status: "REQUESTED" | "FULFILLED" | "CANCELLED";
  operationalWorkDate: string;
  fulfillmentOperationalWorkDate: string | null;
  equipmentId: string | null;
  equipmentDisplayNameSnapshot: string;
  equipmentNumberSnapshot: string | null;
}>;

export type SupplyRequestDailyLogActivityFacts = Readonly<{
  activityType: string;
  title: string;
  activityDate: string;
  dailyLogDate: string;
  equipmentId: string | null;
}>;

export type SupplyRequestDailyLogCompatibilityIssue =
  | "FULFILLMENT_UNAVAILABLE"
  | "ACTIVITY_TYPE_MISMATCH"
  | "ACTIVITY_TITLE_MISMATCH"
  | "ACTIVITY_DATE_MISMATCH"
  | "DAILY_LOG_DATE_MISMATCH"
  | "EQUIPMENT_MISMATCH";

export function supplyRequestDailyLogCanonicalTitle(
  roleValue: SupplyRequestDailyLogRoleValue,
  aggregate: Pick<
    SupplyRequestDailyLogAggregateFacts,
    | "namReference"
    | "equipmentDisplayNameSnapshot"
    | "equipmentNumberSnapshot"
  >,
) {
  if (roleValue === "FULFILLMENT") {
    return `Received all supplies associated with ${aggregate.namReference}.`;
  }
  const equipmentLabel = supplyRequestEquipmentSnapshotLabel(
    aggregate.equipmentDisplayNameSnapshot,
    aggregate.equipmentNumberSnapshot,
  );
  return `Submitted supply request ${aggregate.namReference} for ${equipmentLabel}.`;
}

export function supplyRequestDailyLogRoleDate(
  roleValue: SupplyRequestDailyLogRoleValue,
  aggregate: SupplyRequestDailyLogAggregateFacts,
) {
  if (roleValue === "SUBMISSION") return aggregate.operationalWorkDate;
  return aggregate.status === "FULFILLED"
    ? aggregate.fulfillmentOperationalWorkDate
    : null;
}

export function validateSupplyRequestDailyLogCompatibility(
  roleValue: SupplyRequestDailyLogRoleValue,
  aggregate: SupplyRequestDailyLogAggregateFacts,
  activity: SupplyRequestDailyLogActivityFacts,
): SupplyRequestDailyLogCompatibilityIssue | null {
  const roleDate = supplyRequestDailyLogRoleDate(roleValue, aggregate);
  if (
    roleValue === "FULFILLMENT" &&
    (aggregate.status !== "FULFILLED" ||
      !roleDate ||
      !isCanonicalSupplyRequestDate(roleDate))
  ) {
    return "FULFILLMENT_UNAVAILABLE";
  }
  if (activity.activityType !== "SUPPLY_REQUEST") {
    return "ACTIVITY_TYPE_MISMATCH";
  }
  if (activity.title !== supplyRequestDailyLogCanonicalTitle(roleValue, aggregate)) {
    return "ACTIVITY_TITLE_MISMATCH";
  }
  if (activity.activityDate !== roleDate) return "ACTIVITY_DATE_MISMATCH";
  if (activity.dailyLogDate !== roleDate) return "DAILY_LOG_DATE_MISMATCH";
  if (aggregate.equipmentId === null) {
    return activity.equipmentId === null ? null : "EQUIPMENT_MISMATCH";
  }
  return activity.equipmentId === null ||
    activity.equipmentId === aggregate.equipmentId
    ? null
    : "EQUIPMENT_MISMATCH";
}

export function compatibilityMessage(
  issue: SupplyRequestDailyLogCompatibilityIssue,
) {
  const messages: Record<SupplyRequestDailyLogCompatibilityIssue, string> = {
    FULFILLMENT_UNAVAILABLE:
      "Fulfillment can be linked only while the current Supply Request is Fulfilled with complete fulfillment facts.",
    ACTIVITY_TYPE_MISMATCH:
      "The selected Activity must use the Supply Request classification.",
    ACTIVITY_TITLE_MISMATCH:
      "The selected Activity title must exactly match the required Supply Request title.",
    ACTIVITY_DATE_MISMATCH:
      "The selected Activity must use the required operational date.",
    DAILY_LOG_DATE_MISMATCH:
      "The selected Activity’s Daily Log must use the required operational date.",
    EQUIPMENT_MISMATCH:
      "The selected Activity Equipment is not compatible with the current Supply Request.",
  };
  return messages[issue];
}
