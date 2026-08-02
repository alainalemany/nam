import { z } from "zod";

import {
  knowledgeContentKinds,
  knowledgeContextKinds,
  knowledgeMaximumCautionLength,
  knowledgeMaximumExternalReferenceLabelLength,
  knowledgeMaximumExternalReferences,
  knowledgeMaximumIdentifierLength,
  knowledgeMaximumMutableStateVersion,
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
  "externalReferencesPayload",
]);

const permittedEditFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "title",
  "bodyMarkdown",
  "safetyCaution",
  "contextKind",
  "mineId",
  "equipmentId",
  "externalReferencesPayload",
]);

const permittedReviewFields = new Set([
  "expectedStateVersion",
  "expectedCurrentRevisionId",
  "personalReviewConfirmed",
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

function assertStrictFields(formData: FormData, permittedFields = permittedCreateFields) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (
    counts.size !== permittedFields.size ||
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
    externalReferences,
  });
  return { input, values, externalReferences };
}

function parseExpectedStateVersion(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    invalid("The expected record version is invalid.", "expectedStateVersion");
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > knowledgeMaximumMutableStateVersion
  ) {
    invalid("The expected record version is invalid.", "expectedStateVersion");
  }
  return parsed;
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
    title: knowledgeFormValue(formData, "title"),
    bodyMarkdown: knowledgeFormValue(formData, "bodyMarkdown"),
    safetyCaution: knowledgeFormValue(formData, "safetyCaution"),
    contextKind: knowledgeFormValue(formData, "contextKind"),
    mineId: knowledgeFormValue(formData, "mineId"),
    equipmentId: knowledgeFormValue(formData, "equipmentId"),
  };
}

export function parseKnowledgeEditInput(input: unknown): KnowledgeEditInput {
  const parsed = z
    .object({
      knowledgeRecordId: z.string().uuid(),
      expectedStateVersion: z.union([z.string(), z.number()]),
      expectedCurrentRevisionId: z.string(),
      title: z.string(),
      bodyMarkdown: z.string(),
      safetyCaution: z.string().nullable().optional(),
      contextKind: z.enum(knowledgeContextKinds),
      mineId: z.string().nullable().optional(),
      equipmentId: z.string().nullable().optional(),
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
  return {
    knowledgeRecordId: parsed.data.knowledgeRecordId.toLowerCase(),
    expectedStateVersion,
    expectedCurrentRevisionId: parseExpectedCurrentRevisionId(
      parsed.data.expectedCurrentRevisionId,
    ),
    ...parseEditableMaterial(parsed.data, true),
  };
}

export function parseKnowledgeEditFormData(
  knowledgeRecordId: string,
  formData: FormData,
) {
  assertStrictFields(formData, permittedEditFields);
  const values = knowledgeEditFormValues(formData);
  const externalReferences = parseKnowledgeExternalReferencesPayload(
    knowledgeFormValue(formData, "externalReferencesPayload"),
  );
  const input = parseKnowledgeEditInput({
    knowledgeRecordId,
    ...values,
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
