import {
  DRAGLINE_SHIFT_MINUTES,
  getDraglineShiftWindow,
  type DraglineDelayReportShift,
  validateEventInterval,
} from "./time";

export type DowntimeInput = Readonly<{
  startMinuteOffset: number;
  durationMinutes?: number | null;
  causesDowntime: boolean;
}>;

export type TimelineDowntimeInput = DowntimeInput &
  Readonly<{
    delayCode: string;
  }>;

export type GroundCheckDowntimeInput = Readonly<{
  startMinuteOffset: number;
}>;

export type SharedDowntimeBlockInput = Readonly<{
  startMinuteOffset: number;
  durationMinutes: number;
}>;

export const DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES = 10;

type MinuteInterval = Readonly<{ start: number; end: number }>;

function mergeIntervals(intervals: readonly MinuteInterval[]) {
  const sorted = [...intervals].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const merged: MinuteInterval[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push(interval);
    } else {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, interval.end),
      };
    }
  }

  return merged;
}

function downtimeIntervals(
  shift: DraglineDelayReportShift,
  entries: readonly DowntimeInput[],
) {
  const window = getDraglineShiftWindow(shift);
  return mergeIntervals(entries.flatMap((entry) => {
    validateEventInterval(shift, entry.startMinuteOffset, entry.durationMinutes);
    if (!entry.causesDowntime) return [];
    if (entry.durationMinutes == null) {
      throw new Error("A downtime-causing entry requires a positive duration.");
    }

    const start = Math.max(entry.startMinuteOffset, window.startMinuteOffset);
    const end = entry.startMinuteOffset + entry.durationMinutes;
    return end > start ? [{ start, end }] : [];
  }));
}

function allDowntimeInputs(
  shift: DraglineDelayReportShift,
  entries: readonly DowntimeInput[],
  groundChecks: readonly GroundCheckDowntimeInput[],
  downtimeBlocks: readonly SharedDowntimeBlockInput[],
) {
  const window = getDraglineShiftWindow(shift);
  return [
    ...entries,
    ...groundChecks.flatMap((groundCheck) => {
      const durationMinutes = Math.min(
        DRAGLINE_GROUND_CHECK_DOWNTIME_MINUTES,
        window.endMinuteOffset - groundCheck.startMinuteOffset,
      );
      return durationMinutes > 0
        ? [{
            startMinuteOffset: groundCheck.startMinuteOffset,
            durationMinutes,
            causesDowntime: true,
          }]
        : [];
    }),
    ...downtimeBlocks.map((block) => ({
      startMinuteOffset: block.startMinuteOffset,
      durationMinutes: block.durationMinutes,
      causesDowntime: true,
    })),
  ];
}

export function calculateDraglineDowntime(
  shift: DraglineDelayReportShift,
  entries: readonly DowntimeInput[],
) {
  const total = downtimeIntervals(shift, entries).reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0,
  );

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
  entries: readonly TimelineDowntimeInput[],
  groundChecks: readonly GroundCheckDowntimeInput[] = [],
  downtimeBlocks: readonly SharedDowntimeBlockInput[] = [],
) {
  const downTimeMinutes = calculateDraglineDowntime(
    shift,
    allDowntimeInputs(shift, entries, groundChecks, downtimeBlocks),
  );
  return {
    downTimeMinutes,
    runTimeMinutes: calculateDraglineRuntime(downTimeMinutes),
  };
}

/**
 * Allocates canonical DDR runtime inside a scheduled-shift subrange. Reports
 * with downtime extending beyond the fixed 720-minute window cannot be split
 * truthfully because the DDR model subtracts that later downtime from the
 * fixed budget without identifying which scheduled running minutes it replaces.
 */
export function calculateDraglineRuntimeInRange(
  shift: DraglineDelayReportShift,
  rangeStartMinuteOffset: number,
  rangeEndMinuteOffset: number,
  entries: readonly TimelineDowntimeInput[],
  groundChecks: readonly GroundCheckDowntimeInput[] = [],
  downtimeBlocks: readonly SharedDowntimeBlockInput[] = [],
) {
  const window = getDraglineShiftWindow(shift);
  if (
    !Number.isInteger(rangeStartMinuteOffset) ||
    !Number.isInteger(rangeEndMinuteOffset) ||
    rangeStartMinuteOffset < window.startMinuteOffset ||
    rangeEndMinuteOffset > window.endMinuteOffset ||
    rangeEndMinuteOffset < rangeStartMinuteOffset
  ) {
    throw new Error("Runtime range must fall inside the scheduled shift window.");
  }

  const intervals = downtimeIntervals(
    shift,
    allDowntimeInputs(shift, entries, groundChecks, downtimeBlocks),
  );
  if (intervals.some((interval) => interval.end > window.endMinuteOffset)) {
    throw new Error(
      "This DDR includes downtime after the scheduled shift and cannot be split at a maintenance service time without inventing runtime precision.",
    );
  }

  const downtime = intervals.reduce((total, interval) => {
    const start = Math.max(interval.start, rangeStartMinuteOffset);
    const end = Math.min(interval.end, rangeEndMinuteOffset);
    return total + Math.max(0, end - start);
  }, 0);

  return rangeEndMinuteOffset - rangeStartMinuteOffset - downtime;
}
