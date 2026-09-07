import { describe, expect, it } from "vitest";

import {
  draglineDelayReportErrorSummary,
  draglineDelayReportErrorTargetPaths,
  formatDraglineDelayReportErrorPath,
} from "@/features/dragline-delay-reports/validation-feedback";

describe("Dragline Delay Report validation feedback", () => {
  it("turns top-level and nested paths into operator-facing labels", () => {
    expect(formatDraglineDelayReportErrorPath("startingHourMeter")).toBe(
      "Starting Hour Meter",
    );
    expect(formatDraglineDelayReportErrorPath("operators.1.employeeId")).toBe(
      "Operator 2",
    );
    expect(
      formatDraglineDelayReportErrorPath("timelineEntries.2.delayCode"),
    ).toBe("Timeline row 3 — Delay Code");
    expect(
      formatDraglineDelayReportErrorPath("timelineEntries.3.durationMinutes"),
    ).toBe("Timeline row 4 — Duration");
    expect(formatDraglineDelayReportErrorPath("groundChecks.1.startTime")).toBe(
      "Ground Check 2 — Time",
    );
    expect(formatDraglineDelayReportErrorPath("timelineEntries")).toBe(
      "Timeline",
    );
    expect(formatDraglineDelayReportErrorPath("stationStart")).toBe(
      "Station Start",
    );
    expect(
      formatDraglineDelayReportErrorPath("downtimeBlocks.1.durationMinutes"),
    ).toBe("Shared Downtime Block 2 — Duration");
    expect(
      formatDraglineDelayReportErrorPath(
        "downtimeBlocks.0.activities.2.delayCode",
      ),
    ).toBe("Shared Downtime Block 1 — Activity 3 — Delay Code");
  });

  it("builds an ordered readable summary without duplicate entries", () => {
    expect(
      draglineDelayReportErrorSummary({
        stationEnd: ["Station is invalid.", "Station is invalid."],
        "timelineEntries.2.durationMinutes": [
          "A downtime-causing entry requires a positive duration.",
        ],
      }),
    ).toEqual([
      {
        path: "stationEnd",
        label: "Station End",
        message: "Station is invalid.",
      },
      {
        path: "timelineEntries.2.durationMinutes",
        label: "Timeline row 3 — Duration",
        message: "A downtime-causing entry requires a positive duration.",
      },
    ]);
  });

  it("falls back from a nested control to its row, section, and form", () => {
    expect(
      draglineDelayReportErrorTargetPaths("groundChecks.1.startTime"),
    ).toEqual([
      "groundChecks.1.startTime",
      "groundChecks.1",
      "groundChecks",
      "form",
    ]);
    expect(draglineDelayReportErrorTargetPaths("timelineEntries")).toEqual([
      "timelineEntries",
      "form",
    ]);
    expect(
      draglineDelayReportErrorTargetPaths(
        "downtimeBlocks.0.activities.2.delayCode",
      ),
    ).toEqual([
      "downtimeBlocks.0.activities.2.delayCode",
      "downtimeBlocks.0.activities.2",
      "downtimeBlocks.0.activities",
      "downtimeBlocks.0",
      "downtimeBlocks",
      "form",
    ]);
  });
});
