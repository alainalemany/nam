import { describe, expect, it } from "vitest";

import { orderDraglineDelayReportTimelineItems } from "@/features/dragline-delay-reports/timeline-order";

describe("Dragline Delay Report combined timeline ordering", () => {
  it("uses the persisted shared sequence across normal rows and blocks", () => {
    const ordered = orderDraglineDelayReportTimelineItems(
      [
        { id: "row-1", sequence: 1, startMinuteOffset: 323 },
        { id: "row-2", sequence: 3, startMinuteOffset: 387 },
        { id: "row-3", sequence: 5, startMinuteOffset: 1040 },
      ],
      [
        { id: "block-1", sequence: 2, startMinuteOffset: 335 },
        { id: "block-2", sequence: 4, startMinuteOffset: 410 },
      ],
    );

    expect(ordered.map((item) => `${item.kind}:${item.value.id}`)).toEqual([
      "entry:row-1",
      "block:block-1",
      "entry:row-2",
      "block:block-2",
      "entry:row-3",
    ]);
  });

  it("keeps legacy per-type sequences chronologically integrated until saved", () => {
    const ordered = orderDraglineDelayReportTimelineItems(
      [
        { id: "row-late", sequence: 2, startMinuteOffset: 387 },
        { id: "row-early", sequence: 1, startMinuteOffset: 323 },
      ],
      [{ id: "block", sequence: 1, startMinuteOffset: 335 }],
    );

    expect(ordered.map((item) => item.value.id)).toEqual([
      "row-early",
      "block",
      "row-late",
    ]);
  });

  it("leaves reports without Shared Downtime Blocks in their persisted row order", () => {
    const ordered = orderDraglineDelayReportTimelineItems(
      [
        { id: "row-2", sequence: 2, startMinuteOffset: 320 },
        { id: "row-1", sequence: 1, startMinuteOffset: 400 },
      ],
      [],
    );

    expect(ordered.map((item) => item.value.id)).toEqual(["row-1", "row-2"]);
  });
});
