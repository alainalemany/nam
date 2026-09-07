export const DRAGLINE_DELAY_REPORT_CUT_TYPES = [
  { value: "PRODUCTION", label: "Production" },
  { value: "KEY_CUT", label: "Key Cut" },
  { value: "FACE_CUT", label: "Face Cut" },
  { value: "BOX_CUT", label: "Box Cut" },
  { value: "EXTENDED_KEY_CUT", label: "Extended Key Cut" },
  { value: "OTHER", label: "Other" },
] as const;

export const DRAGLINE_DELAY_REPORT_CUT_TYPE_VALUES =
  DRAGLINE_DELAY_REPORT_CUT_TYPES.map((cutType) => cutType.value) as [
    "PRODUCTION",
    "KEY_CUT",
    "FACE_CUT",
    "BOX_CUT",
    "EXTENDED_KEY_CUT",
    "OTHER",
  ];

export type DraglineDelayReportCutTypeValue =
  (typeof DRAGLINE_DELAY_REPORT_CUT_TYPES)[number]["value"];

export function formatDraglineDelayReportCutType(
  value: DraglineDelayReportCutTypeValue,
) {
  return DRAGLINE_DELAY_REPORT_CUT_TYPES.find(
    (cutType) => cutType.value === value,
  )!.label;
}
