import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeRecordDetail } from "@/features/knowledge-base/KnowledgeRecordDetail";
import { KnowledgeRecordForm } from "@/features/knowledge-base/KnowledgeRecordForm";
import { knowledgeDisclaimer, knowledgeUnverifiedWarning } from "@/features/knowledge-base/constants";
import type { KnowledgeCreateActionState, KnowledgeDetailView } from "@/features/knowledge-base/types";

vi.mock("@/features/knowledge-base/actions", () => ({
  createKnowledgeRecordAction: vi.fn(),
  reviewKnowledgeRecordAction: vi.fn(),
  updateUnverifiedKnowledgeRecordAction: vi.fn(),
}));

afterEach(cleanup);

const initial: KnowledgeCreateActionState = {
  status: "idle", message: "", fieldErrors: {},
  values: { submissionKey: "517ad4fa-91ee-438d-9c0e-eaf42886a850", contentKind: "FIELD_NOTE", title: "", bodyMarkdown: "", safetyCaution: "", contextKind: "GENERAL", mineId: "", equipmentId: "" },
  externalReferences: [],
};
const pageData = {
  mines: [{ id: "mine-1", label: "North Mine — Gillette, WY" }],
  equipment: [{ id: "equipment-1", label: "Dragline 133 — North Mine" }],
  loadError: null,
};

describe("Knowledge Base create and detail components", () => {
  it("presents the complete accessible create boundary without preview or media", () => {
    render(<KnowledgeRecordForm initialState={initial} pageData={pageData} />);
    expect(screen.getByRole("heading", { name: "Personal knowledge boundary" })).toBeInTheDocument();
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(screen.getByText(knowledgeUnverifiedWarning)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Knowledge Record" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Safety Reminder" })).toBeInTheDocument();
    expect(screen.queryByText(/live preview/i)).toHaveTextContent("No live preview");
    expect(screen.queryByLabelText(/upload/i)).toBeNull();
    expect(screen.queryByLabelText(/photo|camera/i)).toBeNull();
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("maxlength");
    expect(screen.getByLabelText("Body (restricted Markdown)")).not.toHaveAttribute("maxlength");
  });

  it("associates field errors and moves focus to the error summary", () => {
    const errorState: KnowledgeCreateActionState = {
      ...initial,
      status: "error",
      message: "Check the Knowledge Record details and try again.",
      fieldErrors: {
        title: ["Title is required."],
        bodyMarkdown: ["Body is required."],
      },
    };
    render(<KnowledgeRecordForm initialState={errorState} pageData={pageData} />);
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Title")).toHaveAttribute(
      "aria-describedby",
      "knowledge-title-error",
    );
    expect(screen.getByLabelText("Body (restricted Markdown)")).toHaveAttribute(
      "aria-describedby",
      "knowledge-body-help knowledge-bodyMarkdown-error",
    );
  });

  it("switches context and manages ordered references up to the boundary", () => {
    render(<KnowledgeRecordForm initialState={initial} pageData={pageData} />);
    fireEvent.click(screen.getByLabelText("Mine"));
    expect(screen.getByLabelText("Active Mine")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Equipment"));
    expect(screen.getByLabelText("Active Equipment")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Add external reference" });
    for (let index = 0; index < 10; index += 1) fireEvent.click(add);
    expect(screen.getByLabelText("Reference 10 label")).toBeInTheDocument();
    expect(add).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(add).toBeEnabled();
  });

  it("renders current General detail with safe Markdown and authority text", () => {
    const detail: KnowledgeDetailView = {
      id: "record-1", title: "Startup reminder", bodyMarkdown: "## Steps\n\nRead the [manual](https://example.com/manual).", safetyCaution: "Verify isolation.", contentKind: "PROCEDURE", contentKindLabel: "Procedure", trust: "UNVERIFIED", trustLabel: "Unverified", lifecycleLabel: "Active", context: { kind: "GENERAL", label: "General" }, externalReferences: [{ sequence: 1, label: "Official manual", url: "https://example.com/manual" }], createdAt: "2026-08-01T12:00:00.000Z", updatedAt: "2026-08-01T12:00:00.000Z", reviewedAt: null, mutationTokens: null,
    };
    render(<KnowledgeRecordDetail detail={detail} />);
    expect(screen.getByRole("heading", { name: "Startup reminder" })).toBeInTheDocument();
    expect(screen.getByText(knowledgeUnverifiedWarning)).toBeInTheDocument();
    expect(screen.getByText(knowledgeDisclaimer)).toBeInTheDocument();
    expect(screen.getByText("Verify isolation.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Official manual" })).toHaveAttribute("href", "https://example.com/manual");
    expect(screen.queryByText(/approved|certified|verified by management|corporate reviewed/i)).toBeNull();
    expect(document.body.innerHTML).not.toContain("submissionKey");
    expect(document.body.innerHTML).not.toContain("currentRevisionId");
  });
});
