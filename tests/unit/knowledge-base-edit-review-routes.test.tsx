import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";

const mocks = vi.hoisted(() => ({
  getEdit: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/knowledge-base/data", () => ({
  getKnowledgeEditPageData: mocks.getEdit,
}));
vi.mock("@/features/knowledge-base/KnowledgeRecordEditForm", () => ({
  KnowledgeRecordEditForm: ({ pageData }: { pageData: { id: string } }) => (
    <div data-testid="edit-form">{pageData.id}</div>
  ),
}));

import EditKnowledgeRecordPage from "@/app/knowledge-base/[id]/edit/page";

describe("Knowledge Base edit route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the stable route identity and server-derived form preparation", async () => {
    mocks.getEdit.mockResolvedValue({ id: "record-1", contentKindLabel: "Field Note" });
    render(await EditKnowledgeRecordPage({ params: Promise.resolve({ id: "record-1" }) }));
    expect(screen.getByRole("heading", { name: "Edit Unverified Knowledge Record" })).toBeInTheDocument();
    expect(screen.getByTestId("edit-form")).toHaveTextContent("record-1");
    expect(mocks.getEdit).toHaveBeenCalledWith("record-1");
  });

  it("uses not-found only for an absent record", async () => {
    mocks.getEdit.mockResolvedValue(null);
    await expect(
      EditKnowledgeRecordPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("not-found");
  });

  it("distinguishes reviewed read-only state from corrupt persisted state safely", async () => {
    mocks.getEdit.mockRejectedValueOnce(new KnowledgeBaseError(
      "RECORD_NOT_EDITABLE",
      "This Knowledge Record is read-only in its current state.",
    ));
    render(await EditKnowledgeRecordPage({ params: Promise.resolve({ id: "reviewed" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge Record is read-only" })).toBeInTheDocument();

    mocks.getEdit.mockRejectedValueOnce(new Error("raw constraint detail"));
    render(await EditKnowledgeRecordPage({ params: Promise.resolve({ id: "corrupt" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge Record unavailable" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("raw constraint detail");
  });
});
