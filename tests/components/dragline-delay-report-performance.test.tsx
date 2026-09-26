import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import type { DraglineDelayReportFormInitialValues } from "@/features/dragline-delay-reports/types";

afterEach(() => {
  cleanup();
  delete window.__NAM_DDR_DIAGNOSTICS__;
});

const equipment = [{
  id: "dragline-1",
  mineId: "mine-1",
  label: "Dragline 1 · Mine 1",
  displayName: "Dragline 1",
  equipmentNumber: "DL-1",
  status: "ACTIVE" as const,
  mineName: "Mine 1",
  cityName: "City 1",
  cityState: "FL",
}];

const employees = [{
  id: "operator-1",
  label: "Operator 1",
  displayName: "Operator 1",
  employeeCode: "1",
  isActive: true,
  isSupervisor: false,
}];

function realisticValues(): DraglineDelayReportFormInitialValues {
  return {
    operationalWorkDate: "2026-09-25",
    shift: "DAY",
    equipmentId: "dragline-1",
    startingHourMeter: "12000",
    endingHourMeter: "",
    supervisorId: "",
    dayShiftFieldLeadId: "",
    nightShiftFieldLeadId: "",
    lakeId: "",
    normalDiggingBuckets: "100",
    benchfillBuckets: "5",
    cutType: "PRODUCTION",
    cutNote: "",
    stationStart: "10+0",
    stationEnd: "11+0",
    depthFeet: "50",
    fuelGallons: "400",
    cableDragFeet: "",
    hoistFeet: "",
    comments: "",
    safetyItemsFound: "",
    actionTaken: "",
    recordVersion: 1,
    operators: [{ clientId: "operator-row", id: "operator-row", employeeId: "operator-1" }],
    timelineEntries: Array.from({ length: 50 }, (_, index) => ({
      clientId: `timeline-${index + 1}`,
      id: `timeline-${index + 1}`,
      sequence: index + 1,
      startTime: `${String(5 + Math.floor(index / 6)).padStart(2, "0")}:${String((index % 6) * 10).padStart(2, "0")}`,
      dayOffset: 0 as const,
      delayCode: index === 49 ? "13" : "0",
      description: `Shift event ${index + 1}`,
      durationMinutes: "10",
      causesDowntime: index % 4 === 0,
    })),
    downtimeBlocks: [],
    groundChecks: [],
  };
}

describe("DraglineDelayReportForm realistic render profile", () => {
  it("isolates unrelated typing and keeps DOM size stable across repeated edits", () => {
    window.__NAM_DDR_DIAGNOSTICS__ = {
      formRenders: 0,
      timelineRowRenders: 0,
      timelineCalculationCalls: 0,
    };
    render(
      <DraglineDelayReportForm
        action={vi.fn(async () => ({ status: "idle" as const, message: "", fieldErrors: {} }))}
        cancelHref="/dragline-delay-reports"
        employeeOptions={employees}
        equipmentOptions={equipment}
        initialValues={realisticValues()}
        lakeOptions={[]}
        reportId="report-1"
        submitLabel="Save Draft"
        supervisorOptions={[]}
      />,
    );

    const counters = window.__NAM_DDR_DIAGNOSTICS__;
    expect(counters.timelineRowRenders).toBe(50);
    expect(counters.timelineCalculationCalls).toBe(1);
    const initialNodeCount = document.querySelectorAll("*").length;

    const comments = screen.getByLabelText("Comments");
    for (let index = 1; index <= 5; index += 1) {
      fireEvent.change(comments, {
        target: { value: `Long shift note ${index}` },
      });
    }
    expect(counters.timelineRowRenders).toBe(50);
    expect(counters.timelineCalculationCalls).toBe(1);
    expect(document.querySelectorAll("*").length).toBe(initialNodeCount);

    fireEvent.change(screen.getByLabelText("Description for row 25"), {
      target: { value: "Updated one timeline row" },
    });
    expect(counters.timelineRowRenders).toBe(51);
    expect(counters.timelineCalculationCalls).toBe(2);
    expect(document.querySelectorAll("*").length).toBe(initialNodeCount);
  }, 20_000);
});
