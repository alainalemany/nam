import {
  DRAGLINE_SHIFT_MINUTES,
  type DraglineDelayReportShift,
  validateEventInterval,
} from "./time";

export type DowntimeInput = Readonly<{
  startMinuteOffset: number;
  durationMinutes?: number | null;
  causesDowntime: boolean;
}>;

export function calculateDraglineDowntime(
  shift: DraglineDelayReportShift,
  entries: readonly DowntimeInput[],
) {
  const intervals = entries.flatMap((entry) => {
    validateEventInterval(shift, entry.startMinuteOffset, entry.durationMinutes);

    if (!entry.causesDowntime) {
      return [];
    }

    if (entry.durationMinutes == null) {
      throw new Error("A downtime-causing entry requires a positive duration.");
    }

    return [
      {
        start: entry.startMinuteOffset,
        end: entry.startMinuteOffset + entry.durationMinutes,
      },
    ];
  });

  intervals.sort((left, right) => left.start - right.start || left.end - right.end);

  let total = 0;
  let activeStart: number | undefined;
  let activeEnd: number | undefined;

  for (const interval of intervals) {
    if (activeStart === undefined || activeEnd === undefined) {
      activeStart = interval.start;
      activeEnd = interval.end;
      continue;
    }

    if (interval.start <= activeEnd) {
      activeEnd = Math.max(activeEnd, interval.end);
      continue;
    }

    total += activeEnd - activeStart;
    activeStart = interval.start;
    activeEnd = interval.end;
  }

  if (activeStart !== undefined && activeEnd !== undefined) {
    total += activeEnd - activeStart;
  }

  if (total > DRAGLINE_SHIFT_MINUTES) {
    throw new Error("Unique downtime cannot exceed the 12-hour shift.");
  }

  return total;
}

export function calculateDraglineRuntime(downTimeMinutes: number) {
  if (
    !Number.isInteger(downTimeMinutes) ||
    downTimeMinutes < 0 ||
    downTimeMinutes > DRAGLINE_SHIFT_MINUTES
  ) {
    throw new Error("Downtime must be between 0 and 720 whole minutes.");
  }

  return DRAGLINE_SHIFT_MINUTES - downTimeMinutes;
}

export function calculateDraglineShiftTotals(
  shift: DraglineDelayReportShift,
  entries: readonly DowntimeInput[],
) {
  const downTimeMinutes = calculateDraglineDowntime(shift, entries);
  return {
    downTimeMinutes,
    runTimeMinutes: calculateDraglineRuntime(downTimeMinutes),
  };
}
