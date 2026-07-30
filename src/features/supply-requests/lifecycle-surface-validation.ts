import { SupplyRequestLifecycleError } from "./lifecycle-errors";
import {
  parseCancelSupplyRequestInput,
  parseFulfillSupplyRequestInput,
} from "./lifecycle-validation";

const fulfillmentFields = new Set([
  "expectedCurrentVersionNumber",
  "fulfillmentOperationalWorkDate",
  "fulfillmentNote",
]);
const cancellationFields = new Set([
  "expectedCurrentVersionNumber",
  "cancellationReason",
]);
const expectedVersionPattern = /^[1-9]\d*$/;

function value(formData: FormData, field: string) {
  const entry = formData.get(field);
  return typeof entry === "string" ? entry : "";
}

function assertOwnedFields(formData: FormData, permitted: ReadonlySet<string>) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (
    [...counts].some(
      ([key, count]) => !permitted.has(key) || count !== 1,
    )
  ) {
    throw new SupplyRequestLifecycleError(
      "INVALID_INPUT",
      "Check the lifecycle details before updating this Supply Request in NAM.",
      "form",
      {
        form: [
          "The submitted form contained unexpected or repeated fields.",
        ],
      },
    );
  }
}

function expectedVersion(formData: FormData) {
  const raw = value(formData, "expectedCurrentVersionNumber");
  if (!expectedVersionPattern.test(raw)) return Number.NaN;
  return Number(raw);
}

export function lifecycleSubmittedValues(formData: FormData) {
  return {
    expectedCurrentVersionNumber: value(
      formData,
      "expectedCurrentVersionNumber",
    ),
    fulfillmentOperationalWorkDate: value(
      formData,
      "fulfillmentOperationalWorkDate",
    ),
    fulfillmentNote: value(formData, "fulfillmentNote"),
    cancellationReason: value(formData, "cancellationReason"),
  };
}

export function parseFulfillSupplyRequestFormData(
  supplyRequestId: unknown,
  formData: FormData,
) {
  assertOwnedFields(formData, fulfillmentFields);
  return parseFulfillSupplyRequestInput({
    supplyRequestId:
      typeof supplyRequestId === "string" ? supplyRequestId : "",
    expectedCurrentVersionNumber: expectedVersion(formData),
    fulfillmentOperationalWorkDate: value(
      formData,
      "fulfillmentOperationalWorkDate",
    ),
    fulfillmentNote: value(formData, "fulfillmentNote"),
  });
}

export function parseCancelSupplyRequestFormData(
  supplyRequestId: unknown,
  formData: FormData,
) {
  assertOwnedFields(formData, cancellationFields);
  return parseCancelSupplyRequestInput({
    supplyRequestId:
      typeof supplyRequestId === "string" ? supplyRequestId : "",
    expectedCurrentVersionNumber: expectedVersion(formData),
    cancellationReason: value(formData, "cancellationReason"),
  });
}
