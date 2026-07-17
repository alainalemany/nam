import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SafetyChecklistSaveConfirmation } from "@/features/operational-safety-checklists/SafetyChecklistSaveConfirmation";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Operational Safety Checklist save confirmation", () => {
  it.each([
    ["created", "Checklist saved in NAM Dashboard."],
    ["corrected", "Checklist correction saved in NAM Dashboard."],
  ] as const)("renders and consumes the %s result", async (outcome, message) => {
    window.history.replaceState(
      {},
      "",
      "/operational-safety-checklists/checklist-1?result=signed-marker",
    );
    render(
      <SafetyChecklistSaveConfirmation
        checklistId="checklist-1"
        outcome={outcome}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("status")).not.toHaveTextContent("corporate");
    expect(screen.getByRole("link", { name: "View Inspection" })).toHaveAttribute(
      "href",
      "#inspection-responses",
    );
    expect(
      screen.getByRole("link", { name: "Create Another Inspection" }),
    ).toHaveAttribute(
      "href",
      "/operational-safety-checklists/new?from=checklist-1",
    );
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("hides consumed confirmation on BFCache restoration", async () => {
    window.history.replaceState(
      {},
      "",
      "/operational-safety-checklists/checklist-1?result=signed-marker",
    );
    render(
      <SafetyChecklistSaveConfirmation checklistId="checklist-1" outcome="created" />,
    );
    await waitFor(() => expect(window.location.search).toBe(""));

    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
