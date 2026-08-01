"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { KnowledgeBaseError, knowledgePersistenceError } from "./errors";
import { createKnowledgeRecord } from "./persistence";
import type {
  KnowledgeCreateActionState,
  KnowledgeCreateFormValues,
  KnowledgeExternalReferenceInput,
} from "./types";
import {
  knowledgeCreateFormValues,
  parseKnowledgeCreateFormData,
  recoverKnowledgeExternalReferences,
} from "./validation";

function errorState(
  error: unknown,
  values: KnowledgeCreateFormValues,
  externalReferences: readonly KnowledgeExternalReferenceInput[],
): KnowledgeCreateActionState {
  const safe = error instanceof KnowledgeBaseError ? error : knowledgePersistenceError();
  return {
    status: "error",
    message: safe.message,
    fieldErrors:
      safe.fieldErrors ??
      (safe.field ? { [safe.field]: [safe.message] } : { form: [safe.message] }),
    values,
    externalReferences,
  };
}

export async function createKnowledgeRecordAction(
  _previousState: KnowledgeCreateActionState,
  formData: FormData,
) {
  const values = knowledgeCreateFormValues(formData);
  const externalReferences = recoverKnowledgeExternalReferences(formData);
  let result: Awaited<ReturnType<typeof createKnowledgeRecord>>;
  try {
    const parsed = parseKnowledgeCreateFormData(formData);
    result = await createKnowledgeRecord(parsed.input);
  } catch (error) {
    return errorState(error, values, externalReferences);
  }

  const path = `/knowledge-base/${encodeURIComponent(result.knowledgeRecordId)}`;
  revalidatePath(path);
  redirect(path);
}
