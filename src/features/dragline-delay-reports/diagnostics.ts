export type DraglineDelayReportDiagnosticCounters = {
  formRenders: number;
  timelineRowRenders: number;
  timelineCalculationCalls: number;
};

declare global {
  interface Window {
    __NAM_DDR_DIAGNOSTICS__?: DraglineDelayReportDiagnosticCounters;
  }
}

/** Development-only, opt-in counters used by the repeatable DDR stress test. */
export function recordDraglineDelayReportDiagnostic(
  metric: keyof DraglineDelayReportDiagnosticCounters,
) {
  if (
    process.env.NODE_ENV === "production" ||
    typeof window === "undefined" ||
    !window.__NAM_DDR_DIAGNOSTICS__
  ) {
    return;
  }
  window.__NAM_DDR_DIAGNOSTICS__[metric] += 1;
}
