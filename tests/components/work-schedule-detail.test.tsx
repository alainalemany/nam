import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdjacentWeeklySchedules: vi.fn(),
  getWeeklySchedule: vi.fn(),
}));

vi.mock("@/features/work-schedule/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/work-schedule/data")>()),
  getAdjacentWeeklySchedules: mocks.getAdjacentWeeklySchedules,
  getWeeklySchedule: mocks.getWeeklySchedule,
}));

import WorkScheduleDetailPage from "@/app/work-schedule/[id]/page";

type CrewPhase = "PLANNED" | "ACTUAL";
type CrewRole = "PRIMARY_EMPLOYEE" | "PARTNER";

function crewMember(
  phase: CrewPhase,
  role: CrewRole,
  displayName: string | null,
  options: { employeeId?: string | null; isUnknown?: boolean } = {},
) {
  return {
    id: `${phase}-${role}-${displayName ?? "unknown"}`,
    dailyAssignmentId: "assignment-1",
    phase,
    role,
    employeeId: options.employeeId ?? null,
    displayName,
    isUnknown: options.isUnknown ?? false,
    notes: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1",
    weeklyScheduleId: "schedule-1",
    assignmentDate: new Date("2026-08-10T00:00:00.000Z"),
    dayOfWeek: 1,
    plannedStatus: "SCHEDULED",
    plannedShift: "DAY",
    plannedEquipmentId: "equipment-1",
    plannedEquipmentDisplayName: "MTECK 2100E",
    plannedEquipmentNumber: "101151",
    plannedEquipmentCategory: "DRAGLINE",
    plannedMineName: "White Rock",
    plannedCityName: "Hialeah",
    plannedCityState: "FL",
    actualStatus: "SCHEDULED",
    actualShift: "DAY",
    actualEquipmentId: "equipment-1",
    actualEquipmentDisplayName: "MTECK 2100E",
    actualEquipmentNumber: "101151",
    actualEquipmentCategory: "DRAGLINE",
    actualMineName: "White Rock",
    actualCityName: "Hialeah",
    actualCityState: "FL",
    changeReason: null,
    plannedNotes: null,
    actualNotes: null,
    plannedEquipment: null,
    actualEquipment: null,
    crewMembers: [],
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function schedule(overrides: Record<string, unknown> = {}) {
  return {
    id: "schedule-1",
    weekStartDate: new Date("2026-08-10T00:00:00.000Z"),
    weekEndDate: new Date("2026-08-16T00:00:00.000Z"),
    status: "ACTIVE",
    primaryEmployeeId: "employee-alain",
    primaryEmployeeDisplayName: "Alain Alemany Arana",
    primaryEmployeeKey: "alain alemany arana",
    assignedByEmployeeId: "employee-supervisor",
    assignedByDisplayName: "Sam Supervisor",
    receivedAt: new Date("2026-08-07T15:30:00.000Z"),
    sourceNote: null,
    scheduleNotes: null,
    primaryEmployee: null,
    assignedByEmployee: null,
    assignments: [assignment()],
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

async function renderPage(value = schedule()) {
  mocks.getWeeklySchedule.mockResolvedValue(value as never);
  render(
    await WorkScheduleDetailPage({
      params: Promise.resolve({ id: "schedule-1" }),
    }),
  );
}

beforeEach(() => {
  mocks.getAdjacentWeeklySchedules.mockResolvedValue({
    previousSchedule: null,
    nextSchedule: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Work Schedule detail summary", () => {
  it("omits blank optional schedule fields and renders populated values", async () => {
    await renderPage(schedule({ sourceNote: "   ", scheduleNotes: null }));

    expect(screen.queryByText("Source note")).not.toBeInTheDocument();
    expect(screen.queryByText("Schedule notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();

    cleanup();
    await renderPage(schedule({
      sourceNote: "Friday supervisor SMS",
      scheduleNotes: "Cover White Rock all week",
    }));

    expect(screen.getByText("Source note")).toBeInTheDocument();
    expect(screen.getByText("Friday supervisor SMS")).toBeInTheDocument();
    expect(screen.getByText("Schedule notes")).toBeInTheDocument();
    expect(screen.getByText("Cover White Rock all week")).toBeInTheDocument();
  });

  it("counts and renders only active assignments", async () => {
    await renderPage(schedule({
      assignments: [
        assignment(),
        assignment({
          id: "assignment-non-working",
          assignmentDate: new Date("2026-08-15T00:00:00.000Z"),
          dayOfWeek: 6,
          plannedStatus: "NON_WORKING",
          actualStatus: "NON_WORKING",
        }),
        assignment({
          id: "assignment-cancelled",
          assignmentDate: new Date("2026-08-16T00:00:00.000Z"),
          dayOfWeek: 7,
          actualStatus: "CANCELLED",
        }),
      ],
    }));

    expect(screen.getByText("1", { selector: ".count-pill" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Monday/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Saturday/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Sunday/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Non-working")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
  });

  it("formats known, single-person, and unknown-partner crews naturally", async () => {
    await renderPage(schedule({
      assignments: [
        assignment({
          crewMembers: [
            crewMember("PLANNED", "PRIMARY_EMPLOYEE", "Alain Alemany Arana"),
            crewMember("PLANNED", "PARTNER", "Erlin Flores"),
          ],
        }),
        assignment({
          id: "assignment-tuesday",
          assignmentDate: new Date("2026-08-11T00:00:00.000Z"),
          dayOfWeek: 2,
          crewMembers: [
            crewMember("PLANNED", "PRIMARY_EMPLOYEE", "Alain Alemany Arana"),
          ],
        }),
        assignment({
          id: "assignment-wednesday",
          assignmentDate: new Date("2026-08-12T00:00:00.000Z"),
          dayOfWeek: 3,
          crewMembers: [
            crewMember("PLANNED", "PRIMARY_EMPLOYEE", "Alain Alemany Arana"),
            crewMember("PLANNED", "PARTNER", null, { isUnknown: true }),
          ],
        }),
      ],
    }));

    expect(screen.getByText("Alain Alemany Arana & Erlin Flores")).toBeInTheDocument();
    expect(screen.getByText("Alain Alemany Arana", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Alain Alemany Arana & Unknown partner")).toBeInTheDocument();
    expect(screen.queryByText(/Primary:/)).not.toBeInTheDocument();
  });

  it("collapses identical assignments and crews while preserving snapshot location", async () => {
    await renderPage(schedule({
      assignments: [assignment({
        actualEquipmentId: null,
        crewMembers: [
          crewMember("PLANNED", "PRIMARY_EMPLOYEE", "Alain Alemany Arana", { employeeId: "employee-alain" }),
          crewMember("PLANNED", "PARTNER", "Erlin Flores", { employeeId: "employee-erlin" }),
          crewMember("ACTUAL", "PRIMARY_EMPLOYEE", "Alain Alemany Arana", { employeeId: "employee-alain" }),
          crewMember("ACTUAL", "PARTNER", "Erlin Flores"),
        ],
      })],
    }));

    const card = screen.getByRole("article");
    expect(within(card).getByText("Assignment", { selector: "dt" })).toBeInTheDocument();
    expect(within(card).queryByText("Planned", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(card).queryByText("Actual", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(card).getByText("Crew", { selector: "dt" })).toBeInTheDocument();
    expect(within(card).queryByText("Planned crew")).not.toBeInTheDocument();
    expect(within(card).queryByText("Actual crew")).not.toBeInTheDocument();
    expect(within(card).getByText("MTECK 2100E #101151 — White Rock, Hialeah"))
      .toBeInTheDocument();
    expect(within(card).queryByText("Change reason")).not.toBeInTheDocument();
  });

  it("shows planned and actual assignment, crew, and populated reason for deviations", async () => {
    await renderPage(schedule({
      assignments: [assignment({
        actualShift: "NIGHT",
        changeReason: "Partner reassigned for night shift",
        crewMembers: [
          crewMember("PLANNED", "PRIMARY_EMPLOYEE", "Alain Alemany Arana", { employeeId: "employee-alain" }),
          crewMember("PLANNED", "PARTNER", "Erlin Flores", { employeeId: "employee-erlin" }),
          crewMember("ACTUAL", "PRIMARY_EMPLOYEE", "Alain Alemany Arana", { employeeId: "employee-alain" }),
          crewMember("ACTUAL", "PARTNER", "Carlos Perez", { employeeId: "employee-carlos" }),
        ],
      })],
    }));

    const card = screen.getByRole("article");
    expect(within(card).getByText("Planned", { selector: "dt" })).toBeInTheDocument();
    expect(within(card).getByText("Actual", { selector: "dt" })).toBeInTheDocument();
    expect(within(card).getByText(/Scheduled \/ Day/)).toBeInTheDocument();
    expect(within(card).getByText(/Scheduled \/ Night/)).toBeInTheDocument();
    expect(within(card).getByText("Planned crew")).toBeInTheDocument();
    expect(within(card).getByText("Alain Alemany Arana & Erlin Flores")).toBeInTheDocument();
    expect(within(card).getByText("Actual crew")).toBeInTheDocument();
    expect(within(card).getByText("Alain Alemany Arana & Carlos Perez")).toBeInTheDocument();
    expect(within(card).getByText("Change reason")).toBeInTheDocument();
    expect(within(card).getByText("Partner reassigned for night shift")).toBeInTheDocument();
  });
});
