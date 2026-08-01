import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeRecordList } from "@/features/knowledge-base/KnowledgeRecordList";
import { knowledgeDisclaimer, knowledgeUnverifiedWarning } from "@/features/knowledge-base/constants";
import type { KnowledgeListFilters } from "@/features/knowledge-base/list-params";

const filters: KnowledgeListFilters = {
  lifecycle: "ACTIVE",
  sort: "UPDATED_DESC",
  page: 1,
};

const data = (overrides: Record<string, unknown> = {}) => ({
  status: "ready" as const,
  rows: [{
    id: "record-1",
    detailHref: "/knowledge-base/record-1",
    title: "Pump observation",
    excerpt: "Visible knowledge only.",
    contentKind: "FIELD_NOTE" as const,
    contentKindLabel: "Field Note",
    trust: "UNVERIFIED" as const,
    trustLabel: "Unverified",
    lifecycle: "ACTIVE" as const,
    lifecycleLabel: "Active",
    contextKind: "EQUIPMENT" as const,
    contextSummary: "Dragline #133 — North Mine, Gillette, WY",
    contextAvailability: "Equipment unavailable",
    updatedAt: "2026-08-01T12:00:00.000Z",
  }],
  mineOptions: [{ id: "mine-1", label: "North Mine — Gillette, WY", active: true }],
  equipmentOptions: [{ id: "equipment-1", label: "Dragline #133 — North Mine", active: false }],
  totalCount: 1,
  activeCount: 1,
  matchingCount: 1,
  page: 1,
  pageCount: 1,
  hasPreviousPage: false,
  hasNextPage: false,
  outOfRange: false,
  ...overrides,
});

afterEach(cleanup);

describe("Knowledge Base list presentation", () => {
  it("renders labeled search, filters, safety text, count, and pointer-owned cards", () => {
    render(<KnowledgeRecordList data={data()} filters={filters} invalidParameters={[]} />);
    expect(screen.getByLabelText("Search current title and body")).toHaveAttribute("type", "search");
    for (const label of ["Lifecycle", "Content kind", "Trust", "Context", "Mine", "Equipment", "Order"]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.getByText(knowledgeDisclaimer)).toBeVisible();
    expect(screen.getByText(knowledgeUnverifiedWarning)).toBeVisible();
    expect(screen.getByText("1 result")).toBeVisible();
    expect(screen.getByRole("link", { name: "Pump observation" })).toHaveAttribute("href", "/knowledge-base/record-1");
    expect(screen.getByText(/Equipment unavailable/u)).toBeVisible();
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: /edit|review|archive|restore|delete/iu })).toBeNull();
  });

  it("shows canonical filter state, inactive options, notices, and retained pagination", () => {
    const selected: KnowledgeListFilters = {
      ...filters,
      q: "pump",
      lifecycle: "ALL",
      mineId: "missing-mine",
      sort: "TITLE_ASC",
      page: 2,
    };
    render(<KnowledgeRecordList
      data={data({ page: 2, pageCount: 3, hasPreviousPage: true, hasNextPage: true })}
      filters={selected}
      invalidParameters={["unsupported parameters"]}
    />);
    expect(screen.getByText(/Active filters: Search/u)).toHaveTextContent("Lifecycle: Active and Archived");
    expect(screen.getByText(/Active filters: Search/u)).toHaveTextContent("Mine: Unavailable live reference");
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(3);
    expect(within(screen.getByLabelText("Mine")).getByRole("option", { name: "Unavailable live reference" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/knowledge-base?q=pump&lifecycle=ALL&mineId=missing-mine&sort=TITLE_ASC&page=3",
    );
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/knowledge-base?q=pump&lifecycle=ALL&mineId=missing-mine&sort=TITLE_ASC",
    );
  });

  it("does not label reviewed-only results with the Unverified warning", () => {
    const reviewedRows = data().rows.map((row) => ({
      ...row,
      trust: "PERSONALLY_REVIEWED" as const,
      trustLabel: "Personally Reviewed",
    }));
    render(
      <KnowledgeRecordList
        data={data({ rows: reviewedRows })}
        filters={{ ...filters, trust: "PERSONALLY_REVIEWED" }}
        invalidParameters={[]}
      />,
    );
    expect(screen.queryByText(knowledgeUnverifiedWarning)).toBeNull();
    expect(screen.getByText(knowledgeDisclaimer)).toBeVisible();
  });

  it.each([
    [
      "No Knowledge Records exist yet",
      { rows: [], totalCount: 0, activeCount: 0, matchingCount: 0 },
      filters,
    ],
    [
      "Only Archived Knowledge Records exist",
      { rows: [], totalCount: 2, activeCount: 0, matchingCount: 0 },
      filters,
    ],
    [
      "No records match this search and filters",
      { rows: [], totalCount: 2, activeCount: 2, matchingCount: 0 },
      { ...filters, q: "missing" },
    ],
    [
      "Requested page is out of range",
      { rows: [], totalCount: 2, activeCount: 2, matchingCount: 2, page: 4, pageCount: 1, outOfRange: true, hasPreviousPage: true },
      { ...filters, page: 4 },
    ],
  ])("renders the distinct %s state", (heading, overrides, state) => {
    render(<KnowledgeRecordList data={data(overrides)} filters={state as KnowledgeListFilters} invalidParameters={[]} />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  });
});
