import { z } from "zod";

import {
  knowledgeContentKinds,
  knowledgeContextKinds,
  knowledgeMaximumCautionLength,
  knowledgeMaximumChangeSummaryLength,
  knowledgeMaximumExternalReferenceLabelLength,
  knowledgeMaximumExternalReferences,
  knowledgeMaximumIdentifierLength,
  knowledgeMaximumMutableStateVersion,
  knowledgeMaximumStateVersion,
  knowledgeMaximumTitleLength,
} from "./constants";
import { KnowledgeBaseError } from "./errors";
import { parseKnowledgeMarkdown } from "./markdown";
import {
  codePointLength,
  normalizeHttpsUrl,
  normalizePlainText,
  normalizeSingleLineText,
  normalizeTitleKey,
} from "./normalization";
import type {
  KnowledgeCreateFormValues,
  KnowledgeCreateInput,
  KnowledgeEditFormValues,
  KnowledgeEditInput,
  KnowledgeExternalReferenceInput,
  KnowledgeReviewInput,
  KnowledgeLifecycleInput,
  KnowledgeDeleteInput,
} from "./types";

const permittedCreateFields = new Set([
  "submissionKey",
  "contentKind",
  "title",
  "bodyMarkdown",
  "safetyCaution",
  "contextKind",
  "mineId",
  "equipmentId",
  "sourceDailyLogId",
  "relatedDefectId",
  "externalReferencesPayload",
]);

const permittedEditFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "contentKind",
  "changeSummary",
  "title",
  "bodyMarkdown",
  "safetyCaution",
  "contextKind",
  "mineId",
  "equipmentId",
  "sourceDailyLogId",
  "relatedDefectId",
  "retainUnavailableSourceDailyLog",
  "retainUnavailableRelatedDefect",
  "externalReferencesPayload",
]);
const optionalCreateFields = new Set(["sourceDailyLogId", "relatedDefectId"]);
const optionalEditFields = new Set([
  "sourceDailyLogId",
  "relatedDefectId",
  "retainUnavailableSourceDailyLog",
  "retainUnavailableRelatedDefect",
]);

const permittedReviewFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "personalReviewConfirmed",
]);

const permittedArchiveFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "archiveConfirmed",
]);

const permittedRestoreFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "restoreConfirmed",
]);

const permittedDeleteFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "deleteConfirmation",
]);

const rawCreateSchema = z
  .object({
    submissionKey: z.string().uuid(),
    contentKind: z.enum(knowledgeContentKinds),
    title: z.string(),
    bodyMarkdown: z.string(),
    safetyCaution: z.string().nullable().optional(),
    contextKind: z.enum(knowledgeContextKinds),
    mineId: z.string().nullable().optional(),
    equipmentId: z.string().nullable().optional(),
    sourceDailyLogId: z.string().nullable().optional(),
    relatedDefectId: z.string().nullable().optional(),
    externalReferences: z
      .array(z.object({ label: z.string(), url: z.string() }).strict())
      .max(knowledgeMaximumExternalReferences),
  })
  .strict();

function invalid(
  message: string,
  field = "form",
  fieldErrors: Readonly<Record<string, readonly string[]>> = {
    [field]: [message],
  },
): never {
  throw new KnowledgeBaseError(
    "INVALID_INPUT",
    "Check the Knowledge Record details and try again.",
    field,
    fieldErrors,
  );
}

export function knowledgeFormValue(formData: FormData, field: string) {
  const values = formData.getAll(field);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : "";
}

function assertStrictFields(
  formData: FormData,
  permittedFields: ReadonlySet<string> = permittedCreateFields,
  optionalFields: ReadonlySet<string> = optionalCreateFields,
) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (
    [...permittedFields].some((field) => !optionalFields.has(field) && counts.get(field) !== 1) ||
    [...counts].some(
      ([key, count]) => !permittedFields.has(key) || count !== 1,
    )
  ) {
    invalid("The submitted form contained unexpected or repeated fields.");
  }
}

export function knowledgeCreateFormValues(
  formData: FormData,
): KnowledgeCreateFormValues {
  return {
    submissionKey: knowledgeFormValue(formData, "submissionKey"),
    contentKind: knowledgeFormValue(formData, "contentKind"),
    title: knowledgeFormValue(formData, "title"),
    bodyMarkdown: knowledgeFormValue(formData, "bodyMarkdown"),
    safetyCaution: knowledgeFormValue(formData, "safetyCaution"),
    contextKind: knowledgeFormValue(formData, "contextKind"),
    mineId: knowledgeFormValue(formData, "mineId"),
    equipmentId: knowledgeFormValue(formData, "equipmentId"),
    sourceDailyLogId: knowledgeFormValue(formData, "sourceDailyLogId"),
    relatedDefectId: knowledgeFormValue(formData, "relatedDefectId"),
  };
}

export function parseKnowledgeExternalReferencesPayload(
  payload: unknown,
): KnowledgeExternalReferenceInput[] {
  if (typeof payload !== "string" || payload.length > 30_000) {
    invalid("External references are invalid.", "externalReferences");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    invalid("External references are invalid.", "externalReferences");
  }
  const parsed = z
    .array(z.object({ label: z.string(), url: z.string() }).strict())
    .max(knowledgeMaximumExternalReferences)
    .safeParse(decoded);
  if (!parsed.success) {
    invalid(
      "Add no more than ten complete external references.",
      "externalReferences",
    );
  }
  return parsed.data;
}

export function recoverKnowledgeExternalReferences(formData: FormData) {
  try {
    return parseKnowledgeExternalReferencesPayload(
      knowledgeFormValue(formData, "externalReferencesPayload"),
    );
  } catch {
    return [];
  }
}

function normalizeOptionalId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) return null;
  if (normalized.length > knowledgeMaximumIdentifierLength) {
    invalid("The selected reference is invalid.", "contextKind");
  }
  return normalized;
}

function normalizeOptionalRelationshipId(
  value: string | null | undefined,
  field: "sourceDailyLogId" | "relatedDefectId",
) {
  if (value === null || value === undefined || value === "") return null;
  if (
    value !== value.trim() ||
    value.length > knowledgeMaximumIdentifierLength ||
    /[\u0000-\u001f\u007f\s]/u.test(value)
  ) {
    invalid("The selected relationship is invalid.", field);
  }
  return value;
}

export function normalizeKnowledgeExternalReferences(
  references: readonly KnowledgeExternalReferenceInput[],
) {
  const normalized = references.map((reference, index) => {
    const label = normalizeSingleLineText(reference.label);
    if (
      label.length === 0 ||
      codePointLength(label) > knowledgeMaximumExternalReferenceLabelLength
    ) {
      invalid(
        `External reference ${index + 1} requires a label of 120 characters or fewer.`,
        "externalReferences",
      );
    }
    return {
      label,
      url: normalizeHttpsUrl(reference.url),
    };
  });
  if (new Set(normalized.map((reference) => reference.url)).size !== normalized.length) {
    invalid(
      "Each normalized external reference URL may appear only once.",
      "externalReferences",
    );
  }
  return normalized;
}

export function parseKnowledgeCreateInput(input: unknown): KnowledgeCreateInput {
  const parsed = rawCreateSchema.safeParse(input);
  if (!parsed.success) invalid("The submitted Knowledge Record is invalid.");

  const title = normalizeSingleLineText(parsed.data.title);
  const normalizedTitle = normalizeTitleKey(title);
  if (
    title.length === 0 ||
    codePointLength(title) > knowledgeMaximumTitleLength ||
    codePointLength(normalizedTitle) > knowledgeMaximumTitleLength
  ) {
    invalid("Title is required and must be 160 characters or fewer.", "title");
  }
  const bodyMarkdown = parseKnowledgeMarkdown(parsed.data.bodyMarkdown).source;
  const cautionInput = parsed.data.safetyCaution ?? "";
  const safetyCaution = normalizePlainText(cautionInput);
  if (
    safetyCaution.length > 0 &&
    codePointLength(safetyCaution) > knowledgeMaximumCautionLength
  ) {
    invalid(
      "Safety caution must be 2000 characters or fewer.",
      "safetyCaution",
    );
  }
  if (cautionInput.length > 0 && safetyCaution.length === 0) {
    invalid(
      "Remove the empty safety caution or enter meaningful text.",
      "safetyCaution",
    );
  }

  const mineId = normalizeOptionalId(parsed.data.mineId);
  const equipmentId = normalizeOptionalId(parsed.data.equipmentId);
  const sourceDailyLogId = normalizeOptionalRelationshipId(
    parsed.data.sourceDailyLogId,
    "sourceDailyLogId",
  );
  const relatedDefectId = normalizeOptionalRelationshipId(
    parsed.data.relatedDefectId,
    "relatedDefectId",
  );
  if (
    (parsed.data.contextKind === "GENERAL" && (mineId || equipmentId)) ||
    (parsed.data.contextKind === "MINE" && (!mineId || equipmentId)) ||
    (parsed.data.contextKind === "EQUIPMENT" && (!equipmentId || mineId))
  ) {
    throw new KnowledgeBaseError(
      "INVALID_CONTEXT",
      "Choose exactly one valid General, Mine, or Equipment context.",
      "contextKind",
    );
  }

  return {
    submissionKey: parsed.data.submissionKey,
    contentKind: parsed.data.contentKind,
    title,
    bodyMarkdown,
    safetyCaution: safetyCaution || null,
    contextKind: parsed.data.contextKind,
    mineId,
    equipmentId,
    sourceDailyLogId,
    relatedDefectId,
    externalReferences: normalizeKnowledgeExternalReferences(
      parsed.data.externalReferences,
    ),
  };
}

export function parseKnowledgeCreateFormData(formData: FormData) {
  assertStrictFields(formData);
  const values = knowledgeCreateFormValues(formData);
  const externalReferences = parseKnowledgeExternalReferencesPayload(
    knowledgeFormValue(formData, "externalReferencesPayload"),
  );
  const input = parseKnowledgeCreateInput({
    submissionKey: values.submissionKey,
    contentKind: values.contentKind,
    title: values.title,
    bodyMarkdown: values.bodyMarkdown,
    safetyCaution: values.safetyCaution,
    contextKind: values.contextKind,
    mineId: values.mineId,
    equipmentId: values.equipmentId,
    sourceDailyLogId: values.sourceDailyLogId,
    relatedDefectId: values.relatedDefectId,
    externalReferences,
  });
  return { input, values, externalReferences };
}

function parseExpectedStateVersion(
  value: unknown,
  maximum = knowledgeMaximumMutableStateVersion,
) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    invalid("The expected record version is invalid.", "expectedStateVersion");
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    invalid("The expected record version is invalid.", "expectedStateVersion");
  }
  return parsed;
}

function parseKnowledgeRecordId(value: unknown) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success || /[\u0000-\u001f\u007f]/u.test(parsed.data)) {
    invalid("The Knowledge Record identifier is invalid.");
  }
  return parsed.data.toLowerCase();
}

function parseExpectedCurrentRevisionId(value: unknown) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success || /[\u0000-\u001f\u007f]/u.test(parsed.data)) {
    invalid(
      "The expected current revision is invalid.",
      "expectedCurrentRevisionId",
    );
  }
  return parsed.data.toLowerCase();
}

function parseEditableMaterial(input: {
  title: string;
  bodyMarkdown: string;
  safetyCaution?: string | null;
  contextKind: (typeof knowledgeContextKinds)[number];
  mineId?: string | null;
  equipmentId?: string | null;
  externalReferences: readonly KnowledgeExternalReferenceInput[];
}, allowSnapshotOnlyContext = false) {
  const title = normalizeSingleLineText(input.title);
  const normalizedTitle = normalizeTitleKey(title);
  if (
    title.length === 0 ||
    codePointLength(title) > knowledgeMaximumTitleLength ||
    codePointLength(normalizedTitle) > knowledgeMaximumTitleLength
  ) {
    invalid("Title is required and must be 160 characters or fewer.", "title");
  }
  const bodyMarkdown = parseKnowledgeMarkdown(input.bodyMarkdown).source;
  const cautionInput = input.safetyCaution ?? "";
  const safetyCaution = normalizePlainText(cautionInput);
  if (
    safetyCaution.length > 0 &&
    codePointLength(safetyCaution) > knowledgeMaximumCautionLength
  ) {
    invalid("Safety caution must be 2000 characters or fewer.", "safetyCaution");
  }
  if (cautionInput.length > 0 && safetyCaution.length === 0) {
    invalid(
      "Remove the empty safety caution or enter meaningful text.",
      "safetyCaution",
    );
  }
  const mineId = normalizeOptionalId(input.mineId);
  const equipmentId = normalizeOptionalId(input.equipmentId);
  if (
    (input.contextKind === "GENERAL" && (mineId || equipmentId)) ||
    (input.contextKind === "MINE" &&
      (equipmentId || (!mineId && !allowSnapshotOnlyContext))) ||
    (input.contextKind === "EQUIPMENT" &&
      (mineId || (!equipmentId && !allowSnapshotOnlyContext)))
  ) {
    throw new KnowledgeBaseError(
      "INVALID_CONTEXT",
      "Choose exactly one valid General, Mine, or Equipment context.",
      "contextKind",
    );
  }
  return {
    title,
    bodyMarkdown,
    safetyCaution: safetyCaution || null,
    contextKind: input.contextKind,
    mineId,
    equipmentId,
    externalReferences: normalizeKnowledgeExternalReferences(
      input.externalReferences,
    ),
  };
}

export function knowledgeEditFormValues(formData: FormData): KnowledgeEditFormValues {
  return {
    expectedStateVersion: knowledgeFormValue(formData, "expectedStateVersion"),
    expectedCurrentRevisionId: knowledgeFormValue(
      formData,
      "expectedCurrentRevisionId",
    ),
    contentKind: knowledgeFormValue(formData, "contentKind"),
    changeSummary: knowledgeFormValue(formData, "changeSummary"),
    title: knowledgeFormValue(formData, "title"),
    bodyMarkdown: knowledgeFormValue(formData, "bodyMarkdown"),
    safetyCaution: knowledgeFormValue(formData, "safetyCaution"),
    contextKind: knowledgeFormValue(formData, "contextKind"),
    mineId: knowledgeFormValue(formData, "mineId"),
    equipmentId: knowledgeFormValue(formData, "equipmentId"),
    sourceDailyLogId: knowledgeFormValue(formData, "sourceDailyLogId"),
    relatedDefectId: knowledgeFormValue(formData, "relatedDefectId"),
    retainUnavailableSourceDailyLog: knowledgeFormValue(
      formData,
      "retainUnavailableSourceDailyLog",
    ),
    retainUnavailableRelatedDefect: knowledgeFormValue(
      formData,
      "retainUnavailableRelatedDefect",
    ),
  };
}

function parseRetentionFlag(
  value: unknown,
  field: "retainUnavailableSourceDailyLog" | "retainUnavailableRelatedDefect",
) {
  if (value === "true") return true;
  if (value === "false") return false;
  invalid("The unavailable relationship choice is invalid.", field);
}

export function parseKnowledgeEditInput(input: unknown): KnowledgeEditInput {
  const parsed = z
    .object({
      knowledgeRecordId: z.string().uuid(),
      expectedStateVersion: z.union([z.string(), z.number()]),
      expectedCurrentRevisionId: z.string(),
      contentKind: z.enum(knowledgeContentKinds),
      changeSummary: z.string().nullable().optional(),
      title: z.string(),
      bodyMarkdown: z.string(),
      safetyCaution: z.string().nullable().optional(),
      contextKind: z.enum(knowledgeContextKinds),
      mineId: z.string().nullable().optional(),
      equipmentId: z.string().nullable().optional(),
      sourceDailyLogId: z.string().nullable().optional(),
      relatedDefectId: z.string().nullable().optional(),
      retainUnavailableSourceDailyLog: z.union([z.boolean(), z.string()]).optional(),
      retainUnavailableRelatedDefect: z.union([z.boolean(), z.string()]).optional(),
      externalReferences: z
        .array(z.object({ label: z.string(), url: z.string() }).strict())
        .max(knowledgeMaximumExternalReferences),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) invalid("The submitted Knowledge Record edit is invalid.");
  const expectedStateVersion = parseExpectedStateVersion(
    String(parsed.data.expectedStateVersion),
  );
  const rawChangeSummary = parsed.data.changeSummary ?? "";
  if (/[\u0000-\u001f\u007f]/u.test(rawChangeSummary)) {
    invalid("Change summary must not contain control characters.", "changeSummary");
  }
  const changeSummary = normalizeSingleLineText(rawChangeSummary);
  if (codePointLength(changeSummary) > knowledgeMaximumChangeSummaryLength) {
    invalid("Change summary must be 500 characters or fewer.", "changeSummary");
  }
  const sourceDailyLogId = normalizeOptionalRelationshipId(
    parsed.data.sourceDailyLogId,
    "sourceDailyLogId",
  );
  const relatedDefectId = normalizeOptionalRelationshipId(
    parsed.data.relatedDefectId,
    "relatedDefectId",
  );
  const retainUnavailableSourceDailyLog = parseRetentionFlag(
    String(parsed.data.retainUnavailableSourceDailyLog ?? false),
    "retainUnavailableSourceDailyLog",
  );
  const retainUnavailableRelatedDefect = parseRetentionFlag(
    String(parsed.data.retainUnavailableRelatedDefect ?? false),
    "retainUnavailableRelatedDefect",
  );
  if (sourceDailyLogId && retainUnavailableSourceDailyLog) {
    invalid(
      "Choose either a live source Daily Log or the retained unavailable snapshot.",
      "sourceDailyLogId",
    );
  }
  if (relatedDefectId && retainUnavailableRelatedDefect) {
    invalid(
      "Choose either a live related Defect or the retained unavailable snapshot.",
      "relatedDefectId",
    );
  }
  return {
    knowledgeRecordId: parsed.data.knowledgeRecordId.toLowerCase(),
    expectedStateVersion,
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(
      parsed.data.expectedCurrentRevisionId,
    ),
    contentKind: parsed.data.contentKind,
    changeSummary: changeSummary || null,
    sourceDailyLogId,
    relatedDefectId,
    retainUnavailableSourceDailyLog,
    retainUnavailableRelatedDefect,
    ...parseEditableMaterial(parsed.data, true),
  };
}

export function parseKnowledgeEditFormData(
  knowledgeRecordId: string,
  formData: FormData,
) {
  assertStrictFields(formData, permittedEditFields, optionalEditFields);
  const values = knowledgeEditFormValues(formData);
  const externalReferences = parseKnowledgeExternalReferencesPayload(
    knowledgeFormValue(formData, "externalReferencesPayload"),
  );
  const input = parseKnowledgeEditInput({
    knowledgeRecordId,
    ...values,
    retainUnavailableSourceDailyLog:
      values.retainUnavailableSourceDailyLog || "false",
    retainUnavailableRelatedDefect:
      values.retainUnavailableRelatedDefect || "false",
    externalReferences,
  });
  return { input, values, externalReferences };
}

export function parseKnowledgeReviewFormData(
  knowledgeRecordId: string,
  formData: FormData,
): KnowledgeReviewInput {
  assertStrictFields(formData, permittedReviewFields);
  if (knowledgeFormValue(formData, "personalReviewConfirmed") !== "true") {
    invalid(
      "Confirm that you personally reviewed the current material.",
      "personalReviewConfirmed",
    );
  }
  return parseKnowledgeReviewInput({
    knowledgeRecordId,
    expectedStateVersion: knowledgeFormValue(formData, "expectedStateVersion"),
    expectedCurrentRevisionId: knowledgeFormValue(
      formData,
      "expectedCurrentRevisionId",
    ),
  });
}

export function parseKnowledgeReviewInput(input: unknown): KnowledgeReviewInput {
  const parsed = z
    .object({
      knowledgeRecordId: z.string().uuid(),
      expectedStateVersion: z.union([z.string(), z.number()]),
      expectedCurrentRevisionId: z.string(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) invalid("The personal-review request is invalid.");
  return {
    knowledgeRecordId: parsed.data.knowledgeRecordId.toLowerCase(),
    expectedStateVersion: parseExpectedStateVersion(
      String(parsed.data.expectedStateVersion),
    ),
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(
      parsed.data.expectedCurrentRevisionId,
    ),
  };
}

function parseLifecycleInput(
  knowledgeRecordId: string,
  formData: FormData,
  permittedFields: ReadonlySet<string>,
  confirmationField: "archiveConfirmed" | "restoreConfirmed",
): KnowledgeLifecycleInput {
  assertStrictFields(formData, permittedFields);
  if (knowledgeFormValue(formData, confirmationField) !== "true") {
    invalid(
      confirmationField === "archiveConfirmed"
        ? "Confirm that this record should become Archived and read-only."
        : "Confirm that this Archived record should be restored.",
      confirmationField,
    );
  }
  return {
    knowledgeRecordId: parseKnowledgeRecordId(knowledgeRecordId),
    expectedStateVersion: parseExpectedStateVersion(
      knowledgeFormValue(formData, "expectedStateVersion"),
    ),
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(
      knowledgeFormValue(formData, "expectedCurrentRevisionId"),
    ),
  };
}

export function parseKnowledgeArchiveFormData(
  knowledgeRecordId: string,
  formData: FormData,
) {
  return parseLifecycleInput(
    knowledgeRecordId,
    formData,
    permittedArchiveFields,
    "archiveConfirmed",
  );
}

export function parseKnowledgeRestoreFormData(
  knowledgeRecordId: string,
  formData: FormData,
) {
  return parseLifecycleInput(
    knowledgeRecordId,
    formData,
    permittedRestoreFields,
    "restoreConfirmed",
  );
}

export function parseKnowledgeDeleteFormData(
  knowledgeRecordId: string,
  formData: FormData,
): KnowledgeDeleteInput {
  assertStrictFields(formData, permittedDeleteFields);
  const confirmationTitle = knowledgeFormValue(formData, "deleteConfirmation");
  if (
    confirmationTitle.length === 0 ||
    codePointLength(confirmationTitle) > knowledgeMaximumTitleLength ||
    /[\u0000-\u001f\u007f]/u.test(confirmationTitle)
  ) {
    invalid(
      "Enter the exact current title to confirm permanent deletion.",
      "deleteConfirmation",
    );
  }
  return {
    knowledgeRecordId: parseKnowledgeRecordId(knowledgeRecordId),
    expectedStateVersion: parseExpectedStateVersion(
      knowledgeFormValue(formData, "expectedStateVersion"),
      knowledgeMaximumStateVersion,
    ),
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(
      knowledgeFormValue(formData, "expectedCurrentRevisionId"),
    ),
    confirmationTitle,
  };
}

export function parseKnowledgeLifecycleInput(
  input: unknown,
  maximumStateVersion = knowledgeMaximumMutableStateVersion,
): KnowledgeLifecycleInput {
  const parsed = z.object({
    knowledgeRecordId: z.string(),
    expectedStateVersion: z.union([z.string(), z.number()]),
    expectedCurrentRevisionId: z.string(),
  }).strict().safeParse(input);
  if (!parsed.success) invalid("The lifecycle request is invalid.");
  return {
    knowledgeRecordId: parseKnowledgeRecordId(parsed.data.knowledgeRecordId),
    expectedStateVersion: parseExpectedStateVersion(
      String(parsed.data.expectedStateVersion),
      maximumStateVersion,
    ),
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(parsed.data.expectedCurrentRevisionId),
  };
}

export function parseKnowledgeDeleteInput(input: unknown): KnowledgeDeleteInput {
  const parsed = z.object({
    knowledgeRecordId: z.string(),
    expectedStateVersion: z.union([z.string(), z.number()]),
    expectedCurrentRevisionId: z.string(),
    confirmationTitle: z.string(),
  }).strict().safeParse(input);
  if (!parsed.success) invalid("The permanent-delete request is invalid.");
  if (parsed.data.confirmationTitle.length === 0 ||
    codePointLength(parsed.data.confirmationTitle) > knowledgeMaximumTitleLength ||
    /[\u0000-\u001f\u007f]/u.test(parsed.data.confirmationTitle)) {
    invalid("Enter the exact current title to confirm permanent deletion.", "deleteConfirmation");
  }
  return {
    knowledgeRecordId: parseKnowledgeRecordId(parsed.data.knowledgeRecordId),
    expectedStateVersion: parseExpectedStateVersion(String(parsed.data.expectedStateVersion), knowledgeMaximumStateVersion),
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(parsed.data.expectedCurrentRevisionId),
    confirmationTitle: parsed.data.confirmationTitle,
  };
}
