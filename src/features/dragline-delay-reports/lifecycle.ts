import { DRAGLINE_SHIFT_CHANGE_DELAY_CODE } from "./catalog";

export type DraglineTimelineChronologyEntry = Readonly<{
  startMinuteOffset: number;
  sequence: number;
  delayCode: string;
}>;

export function finalDraglineTimelineEntry(
  entries: readonly DraglineTimelineChronologyEntry[],
) {
  return [...entries].sort(
    (left, right) =>
      left.startMinuteOffset - right.startMinuteOffset ||
      left.sequence - right.sequence,
  ).at(-1);
}

export function hasFinalShiftChangeEntry(
  entries: readonly DraglineTimelineChronologyEntry[],
) {
  return finalDraglineTimelineEntry(entries)?.delayCode === DRAGLINE_SHIFT_CHANGE_DELAY_CODE;
}
