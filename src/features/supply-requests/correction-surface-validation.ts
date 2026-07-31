import { z } from "zod";

import { SupplyRequestCorrectionError } from "./correction-errors";
import {
  parseCorrectSupplyRequestInput,
} from "./correction-validation";
import type {
  SupplyRequestCorrectionFormValues,
  SupplyRequestSelectedItemInput,
} from "./surface-types";

const maximumPayloadLength = 50_000;
const permittedFields = new Set([
  "expectedCurrentVersionNumber",
  "correctionReason",
  "operationalWorkDate",
  "submittedLocalDate",
  "submittedLocalTime",
  "equipmentId",
  "supervisorId",
  "notes",
  "resultingStatus",
  "itemsPayload",
  "fulfillmentOperationalWorkDate",
  "fulfilledLocalDate",
  "fulfilledLocalTime",
  "fulfillmentNote",
  "cancelledLocalDate",
  "cancelledLocalTime",
  "cancellationReason",
]);
const itemsSchema = z
  .array(
    z
      .object({
        supplyItemId: z.string().trim().min(1).max(100),
        quantity: z.number(),
      })
      .strict(),
  )
  .max(50);

function value(formData: FormData, field: string) {
  const entry = formData.get(field);
  return typeof entry === "string" ? entry : "";
}

function recoveredValue(formData: FormData, field: string, maximum: number) {
  return value(formData, field).slice(0, maximum);
}

function optionalValue(formData: FormData, field: string) {
  const entry = value(formData, field);
  return entry === "" ? undefined : entry;
}

function invalid(message: string, field = "form"): never {
  throw new SupplyRequestCorrectionError(
    "INVALID_INPUT",
    "Check the corrected Supply Request details before saving a new version in NAM.",
    field,
    { [field]: [message] },
  );
}

function assertOwnedFields(formData: FormData) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (
    [...counts].some(
      ([key, count]) => !permittedFields.has(key) || count !== 1,
    )
  ) {
    invalid("The submitted form contained unexpected or repeated fields.");
  }
}

export function parseSupplyRequestCorrectionItems(
  payload: unknown,
): SupplyRequestSelectedItemInput[] {
  if (
    typeof payload !== "string" ||
    payload.length === 0 ||
    payload.length > maximumPayloadLength
  ) {
    invalid("The corrected Supply Item list is invalid.", "items");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    invalid("The corrected Supply Item list is invalid.", "items");
  }
  const parsed = itemsSchema.safeParse(decoded);
  if (!parsed.success) {
    invalid("The corrected Supply Item list is invalid.", "items");
  }
  return parsed.data;
}

export function correctionSubmittedValues(
  formData: FormData,
): SupplyRequestCorrectionFormValues {
  const rawStatus = recoveredValue(formData, "resultingStatus", 9);
  return {
    expectedCurrentVersionNumber: recoveredValue(
      formData,
      "expectedCurrentVersionNumber",
      10,
    ),
    correctionReason: recoveredValue(formData, "correctionReason", 1_000),
    operationalWorkDate: recoveredValue(formData, "operationalWorkDate", 10),
    submittedLocalDate: recoveredValue(formData, "submittedLocalDate", 10),
    submittedLocalTime: recoveredValue(formData, "submittedLocalTime", 5),
    equipmentId: recoveredValue(formData, "equipmentId", 100),
    supervisorId: recoveredValue(formData, "supervisorId", 100),
    notes: recoveredValue(formData, "notes", 2_000),
    resultingStatus:
      rawStatus === "FULFILLED" || rawStatus === "CANCELLED"
        ? rawStatus
        : "REQUESTED",
    fulfillmentOperationalWorkDate: recoveredValue(
      formData,
      "fulfillmentOperationalWorkDate",
      10,
    ),
    fulfilledLocalDate: recoveredValue(formData, "fulfilledLocalDate", 10),
    fulfilledLocalTime: recoveredValue(formData, "fulfilledLocalTime", 5),
    fulfillmentNote: recoveredValue(formData, "fulfillmentNote", 1_000),
    cancelledLocalDate: recoveredValue(formData, "cancelledLocalDate", 10),
    cancelledLocalTime: recoveredValue(formData, "cancelledLocalTime", 5),
    cancellationReason: recoveredValue(formData, "cancellationReason", 1_000),
  };
}

export function parseCorrectSupplyRequestFormData(
  supplyRequestId: unknown,
  formData: FormData,
) {
  assertOwnedFields(formData);
  const values = correctionSubmittedValues(formData);
  const items = parseSupplyRequestCorrectionItems(
    value(formData, "itemsPayload"),
  );
  const rawExpectedVersion = value(formData, "expectedCurrentVersionNumber");
  const expected = /^[1-9]\d*$/u.test(rawExpectedVersion)
    ? Number(rawExpectedVersion)
    : Number.NaN;
  return {
    input: parseCorrectSupplyRequestInput({
      supplyRequestId:
        typeof supplyRequestId === "string" ? supplyRequestId : "",
      expectedCurrentVersionNumber: expected,
      correctionReason: value(formData, "correctionReason"),
      operationalWorkDate: value(formData, "operationalWorkDate"),
      submittedLocalDate: value(formData, "submittedLocalDate"),
      submittedLocalTime: value(formData, "submittedLocalTime"),
      equipmentId: value(formData, "equipmentId"),
      supervisorId: value(formData, "supervisorId"),
      notes: value(formData, "notes"),
      resultingStatus: value(formData, "resultingStatus") as
        | "REQUESTED"
        | "FULFILLED"
        | "CANCELLED",
      items,
      fulfillmentOperationalWorkDate: optionalValue(
        formData,
        "fulfillmentOperationalWorkDate",
      ),
      fulfilledLocalDate: optionalValue(formData, "fulfilledLocalDate"),
      fulfilledLocalTime: optionalValue(formData, "fulfilledLocalTime"),
      fulfillmentNote: optionalValue(formData, "fulfillmentNote"),
      cancelledLocalDate: optionalValue(formData, "cancelledLocalDate"),
      cancelledLocalTime: optionalValue(formData, "cancelledLocalTime"),
      cancellationReason: optionalValue(formData, "cancellationReason"),
    }),
    values,
    items,
  };
}
