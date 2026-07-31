import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/supply-requests/daily-log-link-data", () => ({
  getSupplyRequestDailyLogLinkContext: mocks.context,
}));
vi.mock("@/features/supply-requests/daily-log-link-actions", () => ({
  setSupplyRequestDailyLogLinkAction: mocks.set,
  removeSupplyRequestDailyLogLinkAction: mocks.remove,
}));

import FulfillmentDailyLogLinkPage from "@/app/supply-requests/[id]/daily-log/fulfillment/page";
import SubmissionDailyLogLinkPage from "@/app/supply-requests/[id]/daily-log/submission/page";

function ready(role: "SUBMISSION" | "FULFILLMENT", eligible = true) {
  return {
    status: "ready" as const,
    context: {
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      currentVersionNumber: 1,
      currentStatus: eligible ? "FULFILLED" : "REQUESTED",
      requestTitle: "Supply Request",
      equipmentLabel: "Dragline 101",
      expectedRoleDate: eligible ? "2026-07-31" : null,
      requiredActivityTitle:
        role === "SUBMISSION"
          ? "Submitted supply request SR-2026-0001 for Dragline 101."
          : "Received all supplies associated with SR-2026-0001.",
      role,
      eligible,
      unavailableReason: eligible ? null : "Current status must be Fulfilled.",
      existingLink: null,
      dailyLogs: [],
    },
  };
}

afterEach(cleanup);

describe("Supply Request Daily Log link App Router pages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the canonical submission route", async () => {
    mocks.context.mockResolvedValue(ready("SUBMISSION"));
    render(
      await SubmissionDailyLogLinkPage({
        params: Promise.resolve({ id: "request-1" }),
      }),
    );
    expect(mocks.context).toHaveBeenCalledWith("request-1", "SUBMISSION");
    expect(
      screen.getByRole("heading", { name: "Link Submission to Daily Log" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No Daily Logs exist/)).toBeInTheDocument();
  });

  it("renders the fulfillment route as read-only when status is ineligible", async () => {
    mocks.context.mockResolvedValue(ready("FULFILLMENT", false));
    render(
      await FulfillmentDailyLogLinkPage({
        params: Promise.resolve({ id: "request-1" }),
      }),
    );
    expect(mocks.context).toHaveBeenCalledWith("request-1", "FULFILLMENT");
    expect(
      screen.getByRole("heading", { name: "Fulfillment link unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses repository not-found behavior for an invalid request", async () => {
    mocks.context.mockResolvedValue({ status: "not-found" });
    await expect(
      SubmissionDailyLogLinkPage({
        params: Promise.resolve({ id: "missing" }),
      }),
    ).rejects.toThrow("not-found");
  });

  it("renders safe query-failure wording without raw persistence details", async () => {
    mocks.context.mockResolvedValue({
      status: "error",
      message: "Daily Log link information is temporarily unavailable.",
    });
    render(
      await FulfillmentDailyLogLinkPage({
        params: Promise.resolve({ id: "request-1" }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Daily Log link information is temporarily unavailable.",
    );
    expect(screen.queryByText(/prisma|sqlstate|password/i)).not.toBeInTheDocument();
  });
});
