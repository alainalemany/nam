"use client";

import { useState } from "react";

import { dayClipboardPayload, timesheetClipboardKey } from "./clipboard";
import type { DailyTimeEntryInput, TimesheetLeaveEntryInput } from "./types";

export function TimesheetCopyDayButton({
  sourceDate,
  employeeId,
  workedEntry,
  leaveEntry,
}: {
  sourceDate: string;
  employeeId: string;
  workedEntry?: DailyTimeEntryInput;
  leaveEntry?: TimesheetLeaveEntryInput;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="button secondary"
      type="button"
      onClick={() => {
        window.sessionStorage.setItem(
          timesheetClipboardKey(employeeId),
          JSON.stringify(dayClipboardPayload(sourceDate, workedEntry, leaveEntry)),
        );
        setCopied(true);
      }}
    >
      {copied ? "Day copied" : "Copy day"}
    </button>
  );
}
