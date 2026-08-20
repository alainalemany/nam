export const DRAGLINE_SHIFT_MINUTES = 720;
export const DRAGLINE_TIMELINE_END_MINUTE_OFFSET = 2 * 24 * 60;

export type DraglineDelayReportShift = "DAY" | "NIGHT";

export type ShiftWindow = Readonly<{
  startMinuteOffset: number;
  endMinuteOffset: number;
}>;

const SHIFT_WINDOWS: Record<DraglineDelayReportShift, ShiftWindow> = {
  DAY: { startMinuteOffset: 300, endMinuteOffset: 1020 },
  NIGHT: { startMinuteOffset: 1020, endMinuteOffset: 1740 },
};

export function localOperationalDateValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getDraglineShiftWindow(shift: DraglineDelayReportShift) {
  return SHIFT_WINDOWS[shift];
}

export function parseClockTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Enter a time in HH:MM format.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error("Enter a valid time.");
  }

  return hours * 60 + minutes;
}

export function normalizeEventStartTime(
  clockTime: string,
  dayOffset: 0 | 1,
) {
  return parseClockTime(clockTime) + dayOffset * 24 * 60;
}

export function splitEventStartMinute(startMinuteOffset: number) {
  if (
    !Number.isInteger(startMinuteOffset) ||
    startMinuteOffset < 0 ||
    startMinuteOffset >= 2 * 24 * 60
  ) {
    throw new Error("Event time offset is invalid.");
  }

  const dayOffset = startMinuteOffset >= 24 * 60 ? 1 : 0;
  const minuteOfDay = startMinuteOffset % (24 * 60);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;

  return {
    clockTime: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    dayOffset: dayOffset as 0 | 1,
  };
}

export function formatEventStartMinute(startMinuteOffset: number) {
  const { clockTime, dayOffset } = splitEventStartMinute(startMinuteOffset);
  const [hoursText, minutes] = clockTime.split(":");
  const hours = Number(hoursText);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${period}${dayOffset === 1 ? " (next day)" : ""}`;
}

export function validateEventInterval(
  shift: DraglineDelayReportShift,
  startMinuteOffset: number,
  durationMinutes?: number | null,
) {
  const window = getDraglineShiftWindow(shift);

  if (
    !Number.isInteger(startMinuteOffset) ||
    startMinuteOffset < window.startMinuteOffset ||
    startMinuteOffset >= DRAGLINE_TIMELINE_END_MINUTE_OFFSET
  ) {
    throw new Error(
      "Event start time must be at or after the selected shift start and within the supported two-calendar-day timeline.",
    );
  }

  if (durationMinutes == null) {
    return;
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Duration must be a positive whole number of minutes.");
  }
}

export function validateScheduledShiftStart(
  shift: DraglineDelayReportShift,
  startMinuteOffset: number,
) {
  const window = getDraglineShiftWindow(shift);

  if (
    !Number.isInteger(startMinuteOffset) ||
    startMinuteOffset < window.startMinuteOffset ||
    startMinuteOffset >= window.endMinuteOffset
  ) {
    throw new Error("Event start time must fall within the selected 12-hour shift.");
  }
}
