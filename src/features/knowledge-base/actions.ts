"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { KnowledgeBaseError, knowledgePersistenceError } from "./errors";
import {
  reviewKnowledgeRecord,
} from "./edit-review-persistence";
import { createKnowledgeRecord } from "./persistence";
import { mutateKnowledgeRecord } from "./revision-persistence";
import type {
  KnowledgeCreateActionState,
  KnowledgeCreateFormValues,
  KnowledgeEditActionState,
  KnowledgeEditFormValues,
  KnowledgeExternalReferenceInput,
  KnowledgeMutationResult,
  KnowledgeReviewActionState,
} from "./types";
import {
  knowledgeCreateFormValues,
  knowledgeEditFormValues,
  knowledgeFormValue,
  parseKnowledgeEditFormData,
  parseKnowledgeReviewFormData,
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

function editErrorState(
  error: unknown,
  values: KnowledgeEditFormValues,
  externalReferences: readonly KnowledgeExternalReferenceInput[],
): KnowledgeEditActionState {
  const safe = error instanceof KnowledgeBaseError ? error : knowledgePersistenceError();
  return {
    status: "error",
    message: safe.message,
    requiresReload: [
      "CONCURRENT_MODIFICATION",
      "CURRENT_AUTHORITY_CHANGED",
      "RECORD_NOT_EDITABLE",
      "REVISION_NUMBER_EXHAUSTED",
      "PERSISTED_STATE_INTEGRITY_FAILURE",
    ].includes(safe.code),
    fieldErrors:
      safe.fieldErrors ??
      (safe.field ? { [safe.field]: [safe.message] } : { form: [safe.message] }),
    values,
    externalReferences,
  };
}

function reviewErrorState(
  error: unknown,
  formData: FormData,
): KnowledgeReviewActionState {
  const safe = error instanceof KnowledgeBaseError ? error : knowledgePersistenceError();
  return {
    status: "error",
    message: safe.message,
    requiresReload: [
      "CONCURRENT_MODIFICATION",
      "CURRENT_AUTHORITY_CHANGED",
      "RECORD_NOT_EDITABLE",
      "PERSISTED_STATE_INTEGRITY_FAILURE",
    ].includes(safe.code),
    fieldErrors:
      safe.fieldErrors ??
      (safe.field ? { [safe.field]: [safe.message] } : { form: [safe.message] }),
    expectedStateVersion: knowledgeFormValue(formData, "expectedStateVersion"),
    expectedCurrentRevisionId: knowledgeFormValue(
      formData,
      "expectedCurrentRevisionId",
    ),
    confirmed:
      knowledgeFormValue(formData, "personalReviewConfirmed") === "true",
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

export async function mutateKnowledgeRecordAction(
  knowledgeRecordId: string,
  _previousState: KnowledgeEditActionState,
  formData: FormData,
) {
  const values = knowledgeEditFormValues(formData);
  const externalReferences = recoverKnowledgeExternalReferences(formData);
  let result: KnowledgeMutationResult;
  try {
    const parsed = parseKnowledgeEditFormData(knowledgeRecordId, formData);
    result = await mutateKnowledgeRecord(parsed.input);
  } catch (error) {
    return editErrorState(error, values, externalReferences);
  }

  const detailPath = `/knowledge-base/${encodeURIComponent(result.knowledgeRecordId)}`;
  revalidatePath("/knowledge-base");
  revalidatePath(detailPath);
  revalidatePath(`${detailPath}/edit`);
  revalidatePath(`${detailPath}/history`);
  if (result.revisionNumber) {
    revalidatePath(`${detailPath}/history/${result.revisionNumber}`);
  }
  redirect(detailPath);
}

export async function reviewKnowledgeRecordAction(
  knowledgeRecordId: string,
  _previousState: KnowledgeReviewActionState,
  formData: FormData,
) {
  let result: Awaited<ReturnType<typeof reviewKnowledgeRecord>>;
  try {
    const input = parseKnowledgeReviewFormData(knowledgeRecordId, formData);
    result = await reviewKnowledgeRecord(input);
  } catch (error) {
    return reviewErrorState(error, formData);
  }

  const detailPath = `/knowledge-base/${encodeURIComponent(result.knowledgeRecordId)}`;
  revalidatePath("/knowledge-base");
  revalidatePath(detailPath);
  revalidatePath(`${detailPath}/edit`);
  revalidatePath(`${detailPath}/history`);
  if (result.revisionNumber) {
    revalidatePath(`${detailPath}/history/${result.revisionNumber}`);
  }
  redirect(detailPath);
}
