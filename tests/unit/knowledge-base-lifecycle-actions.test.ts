import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";
import type { KnowledgeLifecycleActionState } from "@/features/knowledge-base/types";

const mocks = vi.hoisted(() => ({
  archive: vi.fn(), restore: vi.fn(), remove: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/knowledge-base/lifecycle-persistence", () => ({
  archiveKnowledgeRecord: mocks.archive,
  restoreKnowledgeRecord: mocks.restore,
  deleteKnowledgeRecord: mocks.remove,
}));
vi.mock("@/features/knowledge-base/edit-review-persistence", () => ({ reviewKnowledgeRecord: vi.fn() }));
vi.mock("@/features/knowledge-base/revision-persistence", () => ({ mutateKnowledgeRecord: vi.fn() }));
vi.mock("@/features/knowledge-base/persistence", () => ({ createKnowledgeRecord: vi.fn() }));

import { archiveKnowledgeRecordAction, deleteKnowledgeRecordAction, restoreKnowledgeRecordAction } from "@/features/knowledge-base/actions";

const recordId = randomUUID(); const revisionId = randomUUID();
const initial: KnowledgeLifecycleActionState = {
  status: "idle", message: "", requiresReload: false, fieldErrors: {},
  expectedStateVersion: "4", expectedCurrentRevisionId: revisionId,
  confirmed: false, deleteConfirmation: "",
};

function form(operation: "archive" | "restore" | "delete") {
  const data = new FormData(); data.set("expectedStateVersion", "4"); data.set("expectedCurrentRevisionId", revisionId);
  if (operation === "archive") data.set("archiveConfirmed", "true");
  if (operation === "restore") data.set("restoreConfirmed", "true");
  if (operation === "delete") data.set("deleteConfirmation", "Exact title");
  return data;
}

describe("Knowledge Base lifecycle actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.mockResolvedValue({ knowledgeRecordId: recordId, operation: "ARCHIVE", stateVersion: 5, duplicate: false });
    mocks.restore.mockResolvedValue({ knowledgeRecordId: recordId, operation: "RESTORE", stateVersion: 5, duplicate: false, revisionNumber: 2 });
    mocks.remove.mockResolvedValue({ knowledgeRecordId: recordId, operation: "DELETE", stateVersion: null, duplicate: false });
  });

  it("binds the stable ID, archives once, revalidates narrow paths, and redirects", async () => {
    await expect(archiveKnowledgeRecordAction(recordId, initial, form("archive"))).rejects.toThrow(`redirect:/knowledge-base/${recordId}`);
    expect(mocks.archive).toHaveBeenCalledWith({ knowledgeRecordId: recordId, expectedStateVersion: 4, expectedCurrentRevisionId: revisionId });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/knowledge-base", `/knowledge-base/${recordId}`, `/knowledge-base/${recordId}/edit`, `/knowledge-base/${recordId}/history`]);
  });

  it("revalidates the RESTORED historical detail after commit", async () => {
    await expect(restoreKnowledgeRecordAction(recordId, initial, form("restore"))).rejects.toThrow(`redirect:/knowledge-base/${recordId}`);
    expect(mocks.restore).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/knowledge-base/${recordId}/history/2`);
  });

  it("deletes only after validation and redirects to the list", async () => {
    await expect(deleteKnowledgeRecordAction(recordId, initial, form("delete"))).rejects.toThrow("redirect:/knowledge-base");
    expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ knowledgeRecordId: recordId, confirmationTitle: "Exact title" }));
  });

  it("requires reload for stale authority and never leaks internal details", async () => {
    mocks.archive.mockRejectedValue(new KnowledgeBaseError("CURRENT_AUTHORITY_CHANGED", "Reload the Knowledge Record."));
    const result = await archiveKnowledgeRecordAction(recordId, initial, form("archive"));
    expect(result).toMatchObject({ status: "error", requiresReload: true, expectedStateVersion: "4", expectedCurrentRevisionId: revisionId, confirmed: true });
    expect(JSON.stringify(result)).not.toMatch(/SQLSTATE|constraint|postgresql/i);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("requires reload when a concurrent delete removes the stable record", async () => {
    mocks.remove.mockRejectedValue(new KnowledgeBaseError("RECORD_NOT_FOUND", "The Knowledge Record could not be found."));
    const result = await deleteKnowledgeRecordAction(recordId, initial, form("delete"));
    expect(result).toMatchObject({ status: "error", requiresReload: true });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects wrong destructive confirmation before persistence", async () => {
    const invalid = form("delete"); invalid.set("deleteConfirmation", "");
    const result = await deleteKnowledgeRecordAction(recordId, initial, invalid);
    expect(result).toMatchObject({ status: "error", requiresReload: false });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
