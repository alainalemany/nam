import { describe, expect, it } from "vitest";

import {
  allocationClipboardPayload,
  dayClipboardPayload,
  parseTimesheetClipboard,
  timesheetClipboardKey,
} from "@/features/timesheets/clipboard";

const allocation = {
  sequence: 4,
  workCodeId: "code-p-151",
  workOrderId: "wo-1",
  allocatedMinutes: 720,
  supportPersonIds: ["support-1"],
  notes: "Preserve this context",
};

describe("Timesheet copy payloads", () => {
  it("scopes transient clipboard storage by employee without adding identity to the payload", () => {
    expect(timesheetClipboardKey("employee/one")).toBe(
      "nam.timesheet.day-clipboard.v1:employee%2Fone",
    );
  });

  it("copies an individual allocation without a source record ID", () => {
    const payload = allocationClipboardPayload("2026-10-08", allocation);
    expect(payload).toEqual({
      version: 1,
      sourceDate: "2026-10-08",
      kind: "ALLOCATION",
      allocation,
    });
    expect(payload).not.toHaveProperty("id");
    expect(payload.allocation).not.toHaveProperty("id");
  });

  it("copies day facts but omits the source date, schedule link, and leave evidence states", () => {
    const payload = dayClipboardPayload(
      "2026-10-08",
      {
        workDate: "2026-10-08",
        clockIn: "17:00",
        clockOut: "05:00",
        unpaidBreakMinutes: 0,
        primaryEquipmentId: "equipment-101151",
        workScheduleDailyAssignmentId: "assignment-source",
        notes: "Production",
        allocations: [allocation],
      },
      {
        workDate: "2026-10-08",
        leaveType: "FTO",
        requestedMinutes: 720,
        workScheduleDailyAssignmentId: "assignment-source",
        notes: "Requested leave",
      },
    );
    expect(payload.workedEntry).not.toHaveProperty("workDate");
    expect(payload.workedEntry).not.toHaveProperty("workScheduleDailyAssignmentId");
    expect(payload.leaveEntry).not.toHaveProperty("workDate");
    expect(payload.leaveEntry).not.toHaveProperty("workScheduleDailyAssignmentId");
    expect(payload.leaveEntry).not.toHaveProperty("approvalStatus");
    expect(payload.leaveEntry).not.toHaveProperty("paymentStatus");
  });

  it("rejects malformed clipboard data", () => {
    expect(parseTimesheetClipboard("not json")).toBeNull();
    expect(parseTimesheetClipboard(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseTimesheetClipboard(JSON.stringify({ version: 1, sourceDate: "bad", kind: "DAY" }))).toBeNull();
  });
});
