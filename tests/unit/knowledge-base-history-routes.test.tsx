import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  revision: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/knowledge-base/history-data", () => ({
  getKnowledgeHistory: mocks.history,
  getKnowledgeHistoricalRevision: mocks.revision,
}));
vi.mock("@/features/knowledge-base/KnowledgeHistory", () => ({
  KnowledgeHistory: ({ history }: { history: { id: string } }) => <div>history:{history.id}</div>,
}));
vi.mock("@/features/knowledge-base/KnowledgeHistoricalRevision", () => ({
  KnowledgeHistoricalRevision: ({ revision }: { revision: { revisionNumber: number } }) => <div>revision:{revision.revisionNumber}</div>,
}));

import KnowledgeHistoryPage from "@/app/knowledge-base/[id]/history/page";
import KnowledgeHistoricalRevisionPage from "@/app/knowledge-base/[id]/history/[revisionNumber]/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("Knowledge Base history routes", () => {
  it("loads stable root history and exact revision-number detail", async () => {
    mocks.history.mockResolvedValue({ id: "record-1" });
    render(await KnowledgeHistoryPage({ params: Promise.resolve({ id: "record-1" }) }));
    expect(screen.getByText("history:record-1")).toBeInTheDocument();
    expect(mocks.history).toHaveBeenCalledWith("record-1");

    cleanup();
    mocks.revision.mockResolvedValue({ revisionNumber: 2 });
    render(await KnowledgeHistoricalRevisionPage({ params: Promise.resolve({ id: "record-1", revisionNumber: "2" }) }));
    expect(screen.getByText("revision:2")).toBeInTheDocument();
    expect(mocks.revision).toHaveBeenCalledWith("record-1", "2");
  });

  it("uses not-found for absent roots or revision numbers", async () => {
    mocks.history.mockResolvedValue(null);
    await expect(KnowledgeHistoryPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("not-found");
    mocks.revision.mockResolvedValue(null);
    await expect(KnowledgeHistoricalRevisionPage({ params: Promise.resolve({ id: "record-1", revisionNumber: "99" }) })).rejects.toThrow("not-found");
  });

  it("maps corrupt persistence to safe unavailable states", async () => {
    mocks.history.mockRejectedValue(new Error("raw SQLSTATE 23505"));
    render(await KnowledgeHistoryPage({ params: Promise.resolve({ id: "record-1" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge history unavailable" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("23505");
    cleanup();
    mocks.revision.mockRejectedValue(new Error("constraint detail"));
    render(await KnowledgeHistoricalRevisionPage({ params: Promise.resolve({ id: "record-1", revisionNumber: "2" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge revision unavailable" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("constraint detail");
  });
});
