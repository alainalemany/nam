import { z } from "zod";

import {
  knowledgeContentKinds,
  knowledgeContextKinds,
  knowledgeMaximumCautionLength,
  knowledgeMaximumExternalReferenceLabelLength,
  knowledgeMaximumExternalReferences,
  knowledgeMaximumIdentifierLength,
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
  KnowledgeExternalReferenceInput,
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

function formValue(formData: FormData, field: string) {
  const values = formData.getAll(field);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : "";
}

function assertStrictFields(formData: FormData) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (
    counts.size !== permittedCreateFields.size ||
    [...counts].some(
      ([key, count]) => !permittedCreateFields.has(key) || count !== 1,
    )
  ) {
    invalid("The submitted form contained unexpected or repeated fields.");
  }
}

export function knowledgeCreateFormValues(
  formData: FormData,
): KnowledgeCreateFormValues {
  return {
    submissionKey: formValue(formData, "submissionKey"),
    contentKind: formValue(formData, "contentKind"),
    title: formValue(formData, "title"),
    bodyMarkdown: formValue(formData, "bodyMarkdown"),
    safetyCaution: formValue(formData, "safetyCaution"),
    contextKind: formValue(formData, "contextKind"),
    mineId: formValue(formData, "mineId"),
    equipmentId: formValue(formData, "equipmentId"),
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
      formValue(formData, "externalReferencesPayload"),
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

function normalizeExternalReferences(
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
    externalReferences: normalizeExternalReferences(
      parsed.data.externalReferences,
    ),
  };
}

export function parseKnowledgeCreateFormData(formData: FormData) {
  assertStrictFields(formData);
  const values = knowledgeCreateFormValues(formData);
  const externalReferences = parseKnowledgeExternalReferencesPayload(
    formValue(formData, "externalReferencesPayload"),
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
