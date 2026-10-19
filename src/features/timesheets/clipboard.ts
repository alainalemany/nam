import type {
  DailyTimeEntryInput,
  TimesheetAllocationInput,
  TimesheetClipboardPayload,
  TimesheetLeaveEntryInput,
  TimesheetNoWorkEntryInput,
} from "./types";

const TIMESHEET_CLIPBOARD_KEY_PREFIX = "nam.timesheet.day-clipboard.v1";

export function timesheetClipboardKey(employeeId: string) {
  return `${TIMESHEET_CLIPBOARD_KEY_PREFIX}:${encodeURIComponent(employeeId)}`;
}

function cloneAllocation(allocation: TimesheetAllocationInput): TimesheetAllocationInput {
  return {
    sequence: allocation.sequence,
    workCodeId: allocation.workCodeId,
    workOrderId: allocation.workOrderId ?? "",
    allocatedMinutes: allocation.allocatedMinutes,
    supportPersonIds: [...allocation.supportPersonIds],
    notes: allocation.notes ?? "",
  };
}

export function allocationClipboardPayload(
  sourceDate: string,
  allocation: TimesheetAllocationInput,
): TimesheetClipboardPayload {
  return {
    version: 1,
    sourceDate,
    kind: "ALLOCATION",
    allocation: cloneAllocation(allocation),
  };
}

export function dayClipboardPayload(
  sourceDate: string,
  workedEntry?: DailyTimeEntryInput,
  leaveEntry?: TimesheetLeaveEntryInput,
  noWorkEntry?: TimesheetNoWorkEntryInput,
): TimesheetClipboardPayload {
  return {
    version: 1,
    sourceDate,
    kind: "DAY",
    ...(workedEntry
      ? {
          workedEntry: {
            clockIn: workedEntry.clockIn,
            clockOut: workedEntry.clockOut,
            unpaidBreakMinutes: workedEntry.unpaidBreakMinutes,
            primaryEquipmentId: workedEntry.primaryEquipmentId,
            notes: workedEntry.notes ?? "",
            allocations: workedEntry.allocations.map(cloneAllocation),
          },
        }
      : {}),
    ...(leaveEntry
      ? {
          leaveEntry: {
            leaveType: "FTO",
            requestedMinutes: leaveEntry.requestedMinutes,
            notes: leaveEntry.notes ?? "",
          },
        }
      : {}),
    ...(noWorkEntry
      ? {
          noWorkEntry: {
            reason: noWorkEntry.reason,
            notes: noWorkEntry.notes ?? "",
          },
        }
      : {}),
  };
}

export function parseTimesheetClipboard(value: string | null): TimesheetClipboardPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as TimesheetClipboardPayload;
    if (parsed.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.sourceDate)) return null;
    if (parsed.kind === "ALLOCATION") {
      return parsed.allocation ? parsed : null;
    }
    if (parsed.kind === "DAY" && (parsed.workedEntry || parsed.leaveEntry || parsed.noWorkEntry)) return parsed;
    return null;
  } catch {
    return null;
  }
}
