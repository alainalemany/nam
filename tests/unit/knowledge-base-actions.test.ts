import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";
import type { KnowledgeCreateActionState } from "@/features/knowledge-base/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/knowledge-base/persistence", () => ({ createKnowledgeRecord: mocks.create }));

import { createKnowledgeRecordAction } from "@/features/knowledge-base/actions";

const initial: KnowledgeCreateActionState = {
  status: "idle", message: "", fieldErrors: {},
  values: { submissionKey: randomUUID(), contentKind: "FIELD_NOTE", title: "", bodyMarkdown: "", safetyCaution: "", contextKind: "GENERAL", mineId: "", equipmentId: "" },
  externalReferences: [],
};

function validForm() {
  const data = new FormData();
  data.set("submissionKey", initial.values.submissionKey);
  data.set("contentKind", "FIELD_NOTE");
  data.set("title", "Troubleshooting observation");
  data.set("bodyMarkdown", "## Symptom\n\nAlarm cleared after inspection.");
  data.set("safetyCaution", "Keep clear of rotating equipment.");
  data.set("contextKind", "GENERAL");
  data.set("mineId", "");
  data.set("equipmentId", "");
  data.set("externalReferencesPayload", JSON.stringify([{ label: "Manual", url: "https://example.com/manual" }]));
  return data;
}

describe("Knowledge Base create Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ knowledgeRecordId: "aa13ce4a-b33b-4ea7-a7d5-b5ca444bce19", duplicate: false });
  });

  it("persists once, revalidates only stable detail, and redirects after commit", async () => {
    await expect(createKnowledgeRecordAction(initial, validForm())).rejects.toThrow("redirect:/knowledge-base/aa13ce4a-b33b-4ea7-a7d5-b5ca444bce19");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/knowledge-base/aa13ce4a-b33b-4ea7-a7d5-b5ca444bce19");
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("rejects repeated scalar fields without persisting", async () => {
    const data = validForm();
    data.append("title", "Repeated");
    const result = await createKnowledgeRecordAction(initial, data);
    expect(result.status).toBe("error");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves submission identity and editable values on safe failure", async () => {
    mocks.create.mockRejectedValue(new KnowledgeBaseError("REFERENCE_INACTIVE", "Select active Equipment.", "equipmentId"));
    const data = validForm();
    data.set("contextKind", "EQUIPMENT");
    data.set("equipmentId", randomUUID());
    const result = await createKnowledgeRecordAction(initial, data);
    expect(result).toMatchObject({
      status: "error",
      values: { submissionKey: initial.values.submissionKey, title: "Troubleshooting observation" },
      externalReferences: [{ label: "Manual", url: "https://example.com/manual" }],
      fieldErrors: { equipmentId: ["Select active Equipment."] },
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
