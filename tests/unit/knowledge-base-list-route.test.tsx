import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPage: vi.fn() }));
vi.mock("@/features/knowledge-base/list-data", () => ({
  getKnowledgeListPage: mocks.getPage,
}));
vi.mock("@/features/knowledge-base/KnowledgeRecordList", () => ({
  KnowledgeRecordList: ({ filters }: { filters: { q?: string; page: number } }) => (
    <div data-testid="list-contract">{filters.q ?? "default"}:{filters.page}</div>
  ),
}));

import KnowledgeBasePage from "@/app/knowledge-base/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPage.mockResolvedValue({ status: "ready" });
});

describe("Knowledge Base discovery route", () => {
  it("server-renders the stable page, create link, and normalized URL state", async () => {
    render(await KnowledgeBasePage({ searchParams: Promise.resolve({ q: "  Pump  ", page: "2" }) }));
    expect(screen.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create Knowledge Record" })).toHaveAttribute("href", "/knowledge-base/new");
    expect(screen.getByTestId("list-contract")).toHaveTextContent("Pump:2");
    expect(mocks.getPage).toHaveBeenCalledWith(expect.objectContaining({ q: "Pump", page: 2 }));
  });

  it("renders query failure distinctly and preserves a canonical retry URL", async () => {
    mocks.getPage.mockResolvedValue({ status: "error", message: "Knowledge Base records are temporarily unavailable. Try loading this page again." });
    render(await KnowledgeBasePage({ searchParams: Promise.resolve({ q: " pump ", unknown: "secret" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/knowledge-base?q=pump");
    expect(document.body.textContent).not.toContain("unknown");
  });
});
