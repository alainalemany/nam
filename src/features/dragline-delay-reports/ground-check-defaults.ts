import type { DraglineDelayReportShift } from "./time";

export type DraglineDelayReportGroundCheckDefault = Readonly<{
  sequence: number;
  startTime: string;
  dayOffset: 0 | 1;
}>;

const GROUND_CHECK_DEFAULTS: Record<
  DraglineDelayReportShift,
  readonly DraglineDelayReportGroundCheckDefault[]
> = {
  DAY: [
    { sequence: 1, startTime: "06:20", dayOffset: 0 },
    { sequence: 2, startTime: "09:30", dayOffset: 0 },
    { sequence: 3, startTime: "12:30", dayOffset: 0 },
    { sequence: 4, startTime: "16:00", dayOffset: 0 },
  ],
  NIGHT: [
    { sequence: 1, startTime: "18:20", dayOffset: 0 },
    { sequence: 2, startTime: "21:30", dayOffset: 0 },
    { sequence: 3, startTime: "00:30", dayOffset: 1 },
    { sequence: 4, startTime: "04:00", dayOffset: 1 },
  ],
};

export function getDefaultGroundChecksForShift(
  shift: DraglineDelayReportShift,
) {
  return GROUND_CHECK_DEFAULTS[shift].map((groundCheck) => ({
    ...groundCheck,
  }));
}

export function isDefaultGroundCheckSetForShift(
  groundChecks: readonly {
    id?: string;
    sequence?: number;
    startTime: string;
    dayOffset: 0 | 1;
  }[],
  shift: DraglineDelayReportShift,
) {
  const defaults = GROUND_CHECK_DEFAULTS[shift];

  return (
    groundChecks.length === defaults.length &&
    groundChecks.every((groundCheck, index) => {
      const expected = defaults[index];
      return (
        !groundCheck.id &&
        (groundCheck.sequence ?? index + 1) === expected.sequence &&
        groundCheck.startTime === expected.startTime &&
        groundCheck.dayOffset === expected.dayOffset
      );
    })
  );
}
