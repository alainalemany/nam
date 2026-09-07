import { describe, expect, it } from "vitest";

import {
  DRAGLINE_DELAY_REPORT_CUT_TYPES,
  formatDraglineDelayReportCutType,
} from "@/features/dragline-delay-reports/cut-types";

describe("Dragline Delay Report cut types", () => {
  it("keeps the approved internal values and user-facing labels exact", () => {
    expect(DRAGLINE_DELAY_REPORT_CUT_TYPES).toEqual([
      { value: "PRODUCTION", label: "Production" },
      { value: "KEY_CUT", label: "Key Cut" },
      { value: "FACE_CUT", label: "Face Cut" },
      { value: "BOX_CUT", label: "Box Cut" },
      { value: "EXTENDED_KEY_CUT", label: "Extended Key Cut" },
      { value: "OTHER", label: "Other" },
    ]);
  });

  it("formats every persisted value for display", () => {
    expect(
      DRAGLINE_DELAY_REPORT_CUT_TYPES.map(({ value }) =>
        formatDraglineDelayReportCutType(value),
      ),
    ).toEqual([
      "Production",
      "Key Cut",
      "Face Cut",
      "Box Cut",
      "Extended Key Cut",
      "Other",
    ]);
  });
});
