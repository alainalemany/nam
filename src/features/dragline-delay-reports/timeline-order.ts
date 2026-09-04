type PersistedTimelineItem = {
  id: string;
  sequence: number;
  startMinuteOffset: number;
};

export type OrderedDraglineDelayReportTimelineItem<
  TEntry extends PersistedTimelineItem,
  TBlock extends PersistedTimelineItem,
> =
  | { kind: "entry"; value: TEntry }
  | { kind: "block"; value: TBlock };

export function orderDraglineDelayReportTimelineItems<
  TEntry extends PersistedTimelineItem,
  TBlock extends PersistedTimelineItem,
>(
  timelineEntries: readonly TEntry[],
  downtimeBlocks: readonly TBlock[],
): Array<OrderedDraglineDelayReportTimelineItem<TEntry, TBlock>> {
  const items: Array<OrderedDraglineDelayReportTimelineItem<TEntry, TBlock>> = [
    ...timelineEntries.map((value) => ({ kind: "entry" as const, value })),
    ...downtimeBlocks.map((value) => ({ kind: "block" as const, value })),
  ];
  const sequences = items
    .map((item) => item.value.sequence)
    .sort((left, right) => left - right);
  const hasUnifiedOrder = sequences.every(
    (sequence, index) => sequence === index + 1,
  );

  if (hasUnifiedOrder) {
    return items.sort(
      (left, right) =>
        left.value.sequence - right.value.sequence ||
        left.value.id.localeCompare(right.value.id),
    );
  }

  // Reports saved before mixed ordering used a separate 1..n sequence for each
  // item type. Preserve their established chronological read/edit presentation
  // until the next save assigns one shared sequence namespace.
  return items.sort(
    (left, right) =>
      left.value.startMinuteOffset - right.value.startMinuteOffset ||
      (left.kind === right.kind
        ? left.value.sequence - right.value.sequence ||
          left.value.id.localeCompare(right.value.id)
        : left.kind === "block"
          ? -1
          : 1),
  );
}
