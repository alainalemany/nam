import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOptions: vi.fn(),
  getDetail: vi.fn(),
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/knowledge-base/data", () => ({
  getKnowledgeCreatePageData: mocks.getOptions,
  getKnowledgeDetail: mocks.getDetail,
}));
vi.mock("@/features/knowledge-base/KnowledgeRecordForm", () => ({
  KnowledgeRecordForm: ({ initialState }: { initialState: { values: { submissionKey: string } } }) => <div data-testid="create-form">{initialState.values.submissionKey}</div>,
}));
vi.mock("@/features/knowledge-base/KnowledgeRecordDetail", () => ({
  KnowledgeRecordDetail: ({ detail }: { detail: { title: string } }) => <div data-testid="current-detail">{detail.title}</div>,
}));

import KnowledgeRecordDetailPage from "@/app/knowledge-base/[id]/page";
import NewKnowledgeRecordPage from "@/app/knowledge-base/new/page";

afterEach(() => document.body.replaceChildren());

describe("Knowledge Base create and stable current-detail routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptions.mockResolvedValue({ mines: [], equipment: [], loadError: null });
    mocks.getDetail.mockResolvedValue({ title: "Startup reminder" });
  });

  it("server-renders create with a feature-owned UUID submission identity", async () => {
    render(await NewKnowledgeRecordPage());
    expect(screen.getByRole("heading", { name: "Create Knowledge Record" })).toBeInTheDocument();
    expect(screen.getByTestId("create-form").textContent).toMatch(/^[0-9a-f-]{36}$/u);
    expect(mocks.getOptions).toHaveBeenCalledOnce();
  });

  it("loads detail by stable route ID", async () => {
    render(await KnowledgeRecordDetailPage({ params: Promise.resolve({ id: "stable-record-id" }) }));
    expect(screen.getByTestId("current-detail")).toHaveTextContent("Startup reminder");
    expect(mocks.getDetail).toHaveBeenCalledWith("stable-record-id");
  });

  it("uses not-found only for an absent record and a safe page for integrity failure", async () => {
    mocks.getDetail.mockResolvedValueOnce(null);
    await expect(KnowledgeRecordDetailPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("not-found");
    mocks.getDetail.mockRejectedValueOnce(new Error("internal constraint detail"));
    render(await KnowledgeRecordDetailPage({ params: Promise.resolve({ id: "corrupt" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge Record unavailable" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("internal constraint detail");
  });
});
