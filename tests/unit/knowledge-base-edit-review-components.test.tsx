import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeRecordDetail } from "@/features/knowledge-base/KnowledgeRecordDetail";
import { KnowledgeRecordEditForm } from "@/features/knowledge-base/KnowledgeRecordEditForm";
import {
  knowledgeDisclaimer,
  knowledgePersonalReviewExplanation,
  knowledgeReviewedReadOnlyExplanation,
  knowledgeUnverifiedWarning,
} from "@/features/knowledge-base/constants";
import type {
  KnowledgeDetailView,
  KnowledgeEditPageData,
} from "@/features/knowledge-base/types";

const actionMocks = vi.hoisted(() => ({
  edit: vi.fn(),
  review: vi.fn(),
}));

vi.mock("@/features/knowledge-base/actions", () => ({
  updateUnverifiedKnowledgeRecordAction: actionMocks.edit,
  reviewKnowledgeRecordAction: actionMocks.review,
  createKnowledgeRecordAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const recordId = "bf7ca7c6-78e8-4f86-b36f-bf3238bd9cab";
const revisionId = "32a793e7-ed30-46e5-8906-03def4e53a17";
const pageData: KnowledgeEditPageData = {
  id: recordId,
  contentKind: "FIELD_NOTE",
  contentKindLabel: "Field Note",
  initialState: {
    status: "idle",
    message: "",
    requiresReload: false,
    fieldErrors: {},
    values: {
      expectedStateVersion: "2",
      expectedCurrentRevisionId: revisionId,
      title: "Existing title",
      bodyMarkdown: "## Existing\n\nBody.",
      safetyCaution: "",
      contextKind: "GENERAL",
      mineId: "",
      equipmentId: "",
    },
    externalReferences: [],
  },
  mines: [{ id: "mine-1", label: "North Mine — Gillette, WY" }],
  equipment: [{ id: "equipment-1", label: "Dragline 133 — North Mine" }],
  loadError: null,
};

function detail(trust: "UNVERIFIED" | "PERSONALLY_REVIEWED"): KnowledgeDetailView {
  return {
    id: recordId,
    title: "Existing title",
    bodyMarkdown: "## Existing\n\nBody.",
    safetyCaution: null,
    contentKind: "FIELD_NOTE",
    contentKindLabel: "Field Note",
    trust,
    trustLabel: trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed",
    lifecycleLabel: "Active",
    context: { kind: "GENERAL", label: "General" },
    externalReferences: [],
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T13:00:00.000Z",
    reviewedAt: trust === "PERSONALLY_REVIEWED" ? "2026-08-01T13:00:00.000Z" : null,
    mutationTokens: trust === "UNVERIFIED"
      ? { expectedStateVersion: 2, expectedCurrentRevisionId: revisionId }
      : null,
  };
}

describe("Knowledge Base edit and personal-review components", () => {
  it("renders an accessible Unverified edit form with fixed kind and no later-phase controls", () => {
    render(<KnowledgeRecordEditForm pageData={pageData} />);
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(screen.getByText(knowledgeUnverifiedWarning)).toBeInTheDocument();
    expect(screen.getByText("Field Note")).toBeInTheDocument();
    expect(document.querySelector('[name="contentKind"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", `/knowledge-base/${recordId}`);
    expect(screen.queryByRole("button", { name: /archive|restore|delete|history/i })).toBeNull();
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("maxlength");
  });

  it("switches context and replaces ordered reference interaction locally", () => {
    render(<KnowledgeRecordEditForm pageData={pageData} />);
    fireEvent.click(screen.getByLabelText("Mine"));
    expect(screen.getByLabelText("Active Mine")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Equipment"));
    expect(screen.getByLabelText("Active Equipment")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Add external reference" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(screen.getByLabelText("Reference 2 label")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Move up" })[1]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.queryByLabelText("Reference 2 label")).toBeNull();
  });

  it("shows edit and explicit review confirmation only for Active Unverified detail", () => {
    render(<KnowledgeRecordDetail detail={detail("UNVERIFIED")} />);
    expect(screen.getByRole("link", { name: "Edit Knowledge Record" })).toBeInTheDocument();
    expect(screen.getByText(knowledgePersonalReviewExplanation)).toBeInTheDocument();
    expect(screen.getByText(knowledgeReviewedReadOnlyExplanation)).toBeInTheDocument();
    expect(screen.getByLabelText(/I confirm that I personally reviewed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as Personally Reviewed" })).toBeInTheDocument();
  });

  it("renders reviewed material read-only without the Unverified warning or mutation controls", () => {
    render(<KnowledgeRecordDetail detail={detail("PERSONALLY_REVIEWED")} />);
    expect(screen.getAllByText("Personally Reviewed").length).toBeGreaterThan(0);
    expect(screen.getByText(knowledgeReviewedReadOnlyExplanation)).toBeInTheDocument();
    expect(screen.queryByText(knowledgeUnverifiedWarning)).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit Knowledge Record" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as Personally Reviewed" })).toBeNull();
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/corporate approval|management approval|certified/i);
  });

  it("requires a fresh load after an optimistic edit conflict", () => {
    const conflictedPage: KnowledgeEditPageData = {
      ...pageData,
      initialState: {
        ...pageData.initialState,
        status: "error",
        message: "This Knowledge Record changed. Reload it.",
        requiresReload: true,
        fieldErrors: { form: ["Reload required."] },
      },
    };
    const { unmount } = render(
      <KnowledgeRecordEditForm pageData={conflictedPage} />,
    );
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Reload current Knowledge Record" }),
    ).toHaveAttribute("href", `/knowledge-base/${recordId}/edit`);
    unmount();
  });

  it("focuses review conflicts and prevents stale-token resubmission", async () => {
    actionMocks.review.mockResolvedValue({
      status: "error",
      message: "The current authority changed. Reload it.",
      requiresReload: true,
      fieldErrors: { form: ["Reload required."] },
      expectedStateVersion: "2",
      expectedCurrentRevisionId: revisionId,
      confirmed: true,
    });
    render(
      <KnowledgeRecordDetail
        detail={detail("UNVERIFIED")}
      />,
    );
    fireEvent.click(
      screen.getByLabelText(/I confirm that I personally reviewed/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mark as Personally Reviewed" }),
    );
    const alert = await screen.findByRole("alert", {
      name: "Personal review was not recorded",
    });
    expect(alert).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Mark as Personally Reviewed" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Reload Knowledge Record" }),
    ).toHaveAttribute("href", `/knowledge-base/${recordId}`);
  });
});
