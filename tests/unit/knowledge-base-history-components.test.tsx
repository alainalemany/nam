import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KnowledgeHistoricalRevision } from "@/features/knowledge-base/KnowledgeHistoricalRevision";
import { KnowledgeHistory } from "@/features/knowledge-base/KnowledgeHistory";
import {
  knowledgeDisclaimer,
  knowledgeHistoryReadOnlyExplanation,
  knowledgePersonalReviewExplanation,
  knowledgeUnverifiedWarning,
} from "@/features/knowledge-base/constants";
import type { KnowledgeHistoricalRevisionView, KnowledgeHistoryView } from "@/features/knowledge-base/types";

afterEach(cleanup);

const history: KnowledgeHistoryView = {
  id: "record-1",
  title: "Current procedure",
  currentRevisionNumber: 2,
  revisions: [{
    revisionNumber: 2,
    href: "/knowledge-base/record-1/history/2",
    isCurrent: true,
    designation: "Current Unverified",
    origin: "REVISED",
    contentKindLabel: "Procedure",
    trustLabel: "Unverified",
    changeSummary: "Clarified the procedure.",
    contextSummary: "General",
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    reviewedAt: null,
  }, {
    revisionNumber: 1,
    href: "/knowledge-base/record-1/history/1",
    isCurrent: false,
    designation: "Retained Reviewed",
    origin: "INITIAL",
    contentKindLabel: "Field Note",
    trustLabel: "Personally Reviewed",
    changeSummary: null,
    contextSummary: "General",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T13:00:00.000Z",
    reviewedAt: "2026-08-01T13:00:00.000Z",
  }],
};

const historical: KnowledgeHistoricalRevisionView = {
  recordId: "record-1",
  revisionNumber: 1,
  isCurrent: false,
  designation: "Retained Reviewed",
  title: "Reviewed observation",
  bodyMarkdown: "## Observation\n\nRead the [manual](https://example.com/manual).",
  safetyCaution: "Verify isolation.",
  contentKindLabel: "Field Note",
  trustLabel: "Personally Reviewed",
  originLabel: "Initial",
  changeSummary: null,
  contextSummary: "General",
  contextAvailability: null,
  externalReferences: [{ sequence: 1, label: "Manual", url: "https://example.com/manual" }],
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T13:00:00.000Z",
  reviewedAt: "2026-08-01T13:00:00.000Z",
  currentHref: "/knowledge-base/record-1",
  historyHref: "/knowledge-base/record-1/history",
};

describe("Knowledge Base history presentation", () => {
  it("renders current-first, stable revision navigation and exact safety text", () => {
    render(<KnowledgeHistory history={history} />);
    expect(screen.getByRole("heading", { name: "Revision history: Current procedure" })).toBeInTheDocument();
    expect(screen.getByText(knowledgeUnverifiedWarning)).toBeInTheDocument();
    expect(screen.getByText(knowledgePersonalReviewExplanation)).toBeInTheDocument();
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(screen.getByText(knowledgeHistoryReadOnlyExplanation)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revision 2" })).toHaveAttribute("href", "/knowledge-base/record-1/history/2");
    expect(screen.getAllByText(/Current Unverified/).length).toBeGreaterThan(0);
  });

  it("renders retained content read-only with safe navigation and no mutation controls", () => {
    render(<KnowledgeHistoricalRevision revision={historical} />);
    expect(screen.getByRole("heading", { name: "Reviewed observation" })).toBeInTheDocument();
    expect(screen.getByText("Verify isolation.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manual" })).toHaveAttribute("href", "https://example.com/manual");
    expect(screen.getByRole("link", { name: "Current Knowledge Record" })).toHaveAttribute("href", "/knowledge-base/record-1");
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(screen.queryByText(knowledgeUnverifiedWarning)).toBeNull();
    expect(screen.queryByRole("button", { name: /edit|review|archive|restore|delete/i })).toBeNull();
    expect(document.body.innerHTML).not.toContain("revision-1");
  });
});
