import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DailyLogDetailPage from "@/app/daily-logs/[id]/page";
import { dailyLogActivityTypeOptions } from "@/features/daily-logs/constants";
import type { SupplyRequestDailyLogLinkContext } from "@/features/supply-requests/daily-log-link-types";
import { SupplyRequestDailyLogLinkForm } from "@/features/supply-requests/SupplyRequestDailyLogLinkForm";
import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";
import type { SupplyRequestDetailView } from "@/features/supply-requests/surface-types";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { dailyLog: { findUnique: mocks.findUnique } },
}));

const action = vi.fn(async (state) => state);

afterEach(cleanup);

function context(overrides: Partial<SupplyRequestDailyLogLinkContext> = {}): SupplyRequestDailyLogLinkContext {
  return {
    supplyRequestId: "request-1",
    namReference: "SR-2026-0001",
    currentVersionNumber: 2,
    currentStatus: "FULFILLED",
    requestTitle: "Supply Request",
    equipmentLabel: "Dragline 101 · 101",
    expectedRoleDate: "2026-07-31",
    requiredActivityTitle:
      "Received all supplies associated with SR-2026-0001.",
    role: "FULFILLMENT",
    eligible: true,
    unavailableReason: null,
    existingLink: null,
    dailyLogs: [
      {
        id: "log-1",
        logDate: "2026-07-31",
        shiftLabel: "Day",
        mineLabel: "Mine A · Wright, WY",
        primaryEquipmentLabel: "Dragline 101 · 101",
        summary: "Received supplies",
        detailHref: "/daily-logs/log-1",
        editHref: "/daily-logs/log-1/edit",
        activities: [
          {
            id: "activity-1",
            dailyLogId: "log-1",
            sequence: 1,
            startTime: "10:00",
            endTime: "10:10",
            title: "Received all supplies associated with SR-2026-0001.",
            equipmentLabel: null,
            dailyLogHref: "/daily-logs/log-1",
            currentlyLinked: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function detail(status: SupplyRequestDetailView["status"] = "FULFILLED"): SupplyRequestDetailView {
  return {
    supplyRequestId: "request-1",
    namReference: "SR-2026-0001",
    versionId: "version-2",
    versionNumber: 2,
    changeKind: status === "FULFILLED" ? "FULFILLED" : "CREATED",
    status,
    operationalWorkDate: "2026-07-30",
    submittedLocalDate: "2026-07-30",
    submittedLocalTime: "08:00",
    equipmentId: "equipment-1",
    equipmentAvailable: true,
    equipmentLabel: "Dragline 101 · 101",
    equipmentDisplayName: "Dragline 101",
    equipmentNumber: "101",
    equipmentCategory: "DRAGLINE",
    mineName: "Mine A",
    cityName: "Wright",
    cityState: "WY",
    requesterDisplayName: "Alain Alemany",
    requesterEmployeeNumber: "911601",
    supervisorId: "supervisor-1",
    supervisorName: "Supervisor One",
    supervisorEmail: "one@example.com",
    notes: null,
    items: [{ id: "line-1", supplyItemId: "item-1", sequence: 1, itemNumber: "A-1", description: "Filter", quantity: 1, unit: "Each" }],
    createdAtLabel: "Jul 30, 2026",
    fulfillmentOperationalWorkDate: status === "FULFILLED" ? "2026-07-31" : null,
    fulfilledLocalDate: status === "FULFILLED" ? "2026-07-31" : null,
    fulfilledLocalTime: status === "FULFILLED" ? "10:00" : null,
    fulfillmentNote: null,
    cancellationLocalDate: null,
    cancellationLocalTime: null,
    cancellationReason: null,
    correctionReason: null,
    correctedByDisplayName: null,
    correctionLocalDate: null,
    correctionLocalTime: null,
  };
}

describe("Supply Request Daily Log link routes and presentation", () => {
  it("renders the eligible role context, exact title, candidates, and explicit actions", () => {
    render(
      <SupplyRequestDailyLogLinkForm
        context={context()}
        setAction={action}
        removeAction={action}
      />,
    );
    expect(screen.getByRole("heading", { name: "Link Fulfillment to Daily Log" })).toBeInTheDocument();
    expect(screen.getByText("SR-2026-0001")).toBeInTheDocument();
    expect(screen.getAllByText("Received all supplies associated with SR-2026-0001.").length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: /Activity 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Fulfillment Activity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create or edit Activity" })).toHaveAttribute("href", "/daily-logs/log-1/edit");
    expect(screen.getByText(/does not create a Daily Log or Activity/i)).toBeInTheDocument();
  });

  it("keeps multiple same-date logs as explicit separate choices", () => {
    const second = { ...context().dailyLogs[0], id: "log-2", detailHref: "/daily-logs/log-2", editHref: "/daily-logs/log-2/edit", activities: [] };
    render(<SupplyRequestDailyLogLinkForm context={context({ dailyLogs: [...context().dailyLogs, second] })} setAction={action} removeAction={action} />);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Open Daily Log" })).toHaveLength(2);
  });

  it("renders existing replacement/removal state without nested forms", () => {
    const existing = {
      role: "FULFILLMENT" as const,
      activityId: "activity-1",
      activityTitle: "Received all supplies associated with SR-2026-0001.",
      activitySequence: 1,
      activityStartTime: "10:00",
      activityEndTime: "10:10",
      dailyLogId: "log-1",
      dailyLogDate: "2026-07-31",
      dailyLogHref: "/daily-logs/log-1",
    };
    const { container } = render(<SupplyRequestDailyLogLinkForm context={context({ existingLink: existing })} setAction={action} removeAction={action} />);
    expect(screen.getByRole("button", { name: "Remove Fulfillment Link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace Fulfillment Link" })).toBeInTheDocument();
    expect(container.querySelector("form form")).toBeNull();
  });

  it("renders Requested fulfillment as unavailable without an actionable form", () => {
    render(<SupplyRequestDailyLogLinkForm context={context({ currentStatus: "REQUESTED", expectedRoleDate: null, eligible: false, unavailableReason: "Fulfillment requires current Fulfilled status.", dailyLogs: [] })} setAction={action} removeAction={action} />);
    expect(screen.getByRole("heading", { name: "Fulfillment link unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Link Fulfillment/ })).not.toBeInTheDocument();
  });

  it("shows add, linked, open, replace, and unavailable states on current detail", () => {
    const submission = {
      role: "SUBMISSION" as const,
      activityId: "activity-1",
      activityTitle: "Submitted supply request SR-2026-0001 for Dragline 101 · 101.",
      activitySequence: 1,
      activityStartTime: "08:00",
      activityEndTime: null,
      dailyLogId: "log-1",
      dailyLogDate: "2026-07-30",
      dailyLogHref: "/daily-logs/log-1",
    };
    const { rerender } = render(<SupplyRequestDetail detail={detail("REQUESTED")} dailyLogLinks={{ submission, fulfillment: null }} />);
    const links = screen.getByRole("heading", { name: "Daily Log Links" }).closest("section")!;
    expect(within(links).getByRole("link", { name: "Open Daily Log" })).toBeInTheDocument();
    expect(within(links).getByRole("link", { name: "Replace or Remove Link" })).toBeInTheDocument();
    expect(within(links).getByText(/available only while.*Fulfilled/i)).toBeInTheDocument();
    rerender(<SupplyRequestDetail detail={detail("FULFILLED")} dailyLogLinks={{ submission: null, fulfillment: null }} />);
    expect(screen.getByRole("link", { name: "Add Submission to Daily Log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add Fulfillment to Daily Log" })).toBeInTheDocument();
  });

  it("adds the Daily Log classification and follows only the explicit source link", async () => {
    expect(dailyLogActivityTypeOptions).toContainEqual({ value: "SUPPLY_REQUEST", label: "Supply Request" });
    mocks.findUnique.mockResolvedValue({
      id: "log-1",
      logDate: new Date("2026-07-30T00:00:00.000Z"),
      shift: "DAY",
      summary: "Summary",
      weatherConditions: null,
      generalNotes: null,
      mine: null,
      primaryEquipment: null,
      activities: [
        {
          id: "activity-1",
          startTime: "08:00",
          endTime: null,
          activityType: "SUPPLY_REQUEST",
          title: "Canonical-looking title",
          description: null,
          equipment: null,
          location: null,
          contractorCompany: null,
          personName: null,
          notes: null,
          supplyRequestLink: {
            role: "SUBMISSION",
            supplyRequest: { id: "request/1", namReference: "SR-2026-0001" },
          },
        },
        {
          id: "activity-2",
          startTime: null,
          endTime: null,
          activityType: "SUPPLY_REQUEST",
          title: "Submitted supply request SR-2026-9999 for Equipment.",
          description: null,
          equipment: null,
          location: null,
          contractorCompany: null,
          personName: null,
          notes: null,
          supplyRequestLink: null,
        },
      ],
    });
    render(await DailyLogDetailPage({ params: Promise.resolve({ id: "log-1" }) }));
    expect(screen.getByRole("link", { name: "SR-2026-0001" })).toHaveAttribute("href", "/supply-requests/request%2F1");
    expect(screen.getByText(/Supply Request Submission/)).toBeInTheDocument();
    expect(screen.getAllByText("Supply Request")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "SR-2026-9999" })).not.toBeInTheDocument();
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          activities: expect.objectContaining({
            include: expect.objectContaining({
              supplyRequestLink: {
                select: {
                  role: true,
                  supplyRequest: {
                    select: { id: true, namReference: true },
                  },
                },
              },
            }),
          }),
        }),
      }),
    );
  });
});
