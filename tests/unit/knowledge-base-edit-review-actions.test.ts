import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";
import type {
  KnowledgeEditActionState,
  KnowledgeReviewActionState,
} from "@/features/knowledge-base/types";

const mocks = vi.hoisted(() => ({
  edit: vi.fn(),
  review: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/knowledge-base/edit-review-persistence", () => ({
  reviewKnowledgeRecord: mocks.review,
}));
vi.mock("@/features/knowledge-base/revision-persistence", () => ({
  mutateKnowledgeRecord: mocks.edit,
}));
vi.mock("@/features/knowledge-base/persistence", () => ({
  createKnowledgeRecord: vi.fn(),
}));

import {
  reviewKnowledgeRecordAction,
  mutateKnowledgeRecordAction,
} from "@/features/knowledge-base/actions";

const recordId = randomUUID();
const revisionId = randomUUID();
const editInitial: KnowledgeEditActionState = {
  status: "idle",
  message: "",
  requiresReload: false,
  fieldErrors: {},
  values: {
    expectedStateVersion: "2",
    expectedCurrentRevisionId: revisionId,
    contentKind: "FIELD_NOTE",
    changeSummary: "",
    title: "Existing",
    bodyMarkdown: "Existing body",
    safetyCaution: "",
    contextKind: "GENERAL",
    mineId: "",
    equipmentId: "",
  },
  externalReferences: [],
};
const reviewInitial: KnowledgeReviewActionState = {
  status: "idle",
  message: "",
  requiresReload: false,
  fieldErrors: {},
  expectedStateVersion: "2",
  expectedCurrentRevisionId: revisionId,
  confirmed: false,
};

function editForm() {
  const data = new FormData();
  data.set("expectedStateVersion", "2");
  data.set("expectedCurrentRevisionId", revisionId);
  data.set("contentKind", "FIELD_NOTE");
  data.set("changeSummary", "");
  data.set("title", "Updated");
  data.set("bodyMarkdown", "## Updated\n\nContent.");
  data.set("safetyCaution", "");
  data.set("contextKind", "GENERAL");
  data.set("mineId", "");
  data.set("equipmentId", "");
  data.set("externalReferencesPayload", "[]");
  return data;
}

function reviewForm() {
  const data = new FormData();
  data.set("expectedStateVersion", "2");
  data.set("expectedCurrentRevisionId", revisionId);
  data.set("personalReviewConfirmed", "true");
  return data;
}

describe("Knowledge Base edit and personal-review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.edit.mockResolvedValue({ knowledgeRecordId: recordId, stateVersion: 3, duplicate: false, revisionNumber: 1 });
    mocks.review.mockResolvedValue({ knowledgeRecordId: recordId, stateVersion: 3, duplicate: false, revisionNumber: 1 });
  });

  it("binds the route identity, calls edit once, revalidates only Knowledge Base paths, then redirects", async () => {
    await expect(
      mutateKnowledgeRecordAction(recordId, editInitial, editForm()),
    ).rejects.toThrow(`redirect:/knowledge-base/${recordId}`);
    expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({
      knowledgeRecordId: recordId,
      expectedStateVersion: 2,
      expectedCurrentRevisionId: revisionId,
    }));
    expect(mocks.edit).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/knowledge-base",
      `/knowledge-base/${recordId}`,
      `/knowledge-base/${recordId}/edit`,
      `/knowledge-base/${recordId}/history`,
      `/knowledge-base/${recordId}/history/1`,
    ]);
  });

  it("revalidates the stable historical detail after reviewed revision creation", async () => {
    mocks.edit.mockResolvedValue({
      knowledgeRecordId: recordId,
      stateVersion: 3,
      duplicate: false,
      revisionNumber: 2,
    });
    const data = editForm();
    data.set("changeSummary", "Clarified the reviewed material.");
    await expect(
      mutateKnowledgeRecordAction(recordId, editInitial, data),
    ).rejects.toThrow(`redirect:/knowledge-base/${recordId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/knowledge-base/${recordId}/history/2`,
    );
  });

  it("preserves editable values and concurrency tokens after a safe conflict", async () => {
    mocks.edit.mockRejectedValue(new KnowledgeBaseError(
      "CONCURRENT_MODIFICATION",
      "This Knowledge Record changed after the form was loaded. Reload it before trying again.",
    ));
    const data = editForm();
    data.set("externalReferencesPayload", JSON.stringify([{ label: "Manual", url: "https://example.com/manual" }]));
    const result = await mutateKnowledgeRecordAction(recordId, editInitial, data);
    expect(result).toMatchObject({
      status: "error",
      requiresReload: true,
      values: {
        expectedStateVersion: "2",
        expectedCurrentRevisionId: revisionId,
        title: "Updated",
      },
      externalReferences: [{ label: "Manual", url: "https://example.com/manual" }],
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps ordinary validation failures editable without treating tokens as stale", async () => {
    const invalid = editForm();
    invalid.set("title", "   ");
    const result = await mutateKnowledgeRecordAction(
      recordId,
      editInitial,
      invalid,
    );
    expect(result).toMatchObject({
      status: "error",
      requiresReload: false,
      values: { expectedStateVersion: "2" },
    });
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("records review from exact tokens and uses the same narrow revalidation boundary", async () => {
    await expect(
      reviewKnowledgeRecordAction(recordId, reviewInitial, reviewForm()),
    ).rejects.toThrow(`redirect:/knowledge-base/${recordId}`);
    expect(mocks.review).toHaveBeenCalledWith({
      knowledgeRecordId: recordId,
      expectedStateVersion: 2,
      expectedCurrentRevisionId: revisionId,
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/knowledge-base",
      `/knowledge-base/${recordId}`,
      `/knowledge-base/${recordId}/edit`,
      `/knowledge-base/${recordId}/history`,
      `/knowledge-base/${recordId}/history/1`,
    ]);
  });

  it("maps review conflicts safely without swallowing redirect control flow", async () => {
    mocks.review.mockRejectedValue(new KnowledgeBaseError(
      "CURRENT_AUTHORITY_CHANGED",
      "The current Knowledge Record authority changed. Reload it before trying again.",
    ));
    const result = await reviewKnowledgeRecordAction(recordId, reviewInitial, reviewForm());
    expect(result).toMatchObject({
      status: "error",
      requiresReload: true,
      expectedStateVersion: "2",
      expectedCurrentRevisionId: revisionId,
      confirmed: true,
    });
    expect(JSON.stringify(result)).not.toContain("SQLSTATE");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
