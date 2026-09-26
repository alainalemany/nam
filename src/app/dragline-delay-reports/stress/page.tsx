import { notFound } from "next/navigation";

import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import type { DraglineDelayReportFormInitialValues } from "@/features/dragline-delay-reports/types";

import {
  getStressDraft,
  stressDraglineAutosaveAction,
  stressDraglineFormAction,
} from "./actions";

export const dynamic = "force-dynamic";

function initialStressValues(): DraglineDelayReportFormInitialValues {
  return {
    operationalWorkDate: "2026-09-25",
    shift: "DAY",
    equipmentId: "stress-dragline",
    startingHourMeter: "12000",
    endingHourMeter: "",
    supervisorId: "",
    dayShiftFieldLeadId: "",
    nightShiftFieldLeadId: "",
    lakeId: "",
    normalDiggingBuckets: "120",
    benchfillBuckets: "10",
    cutType: "PRODUCTION",
    cutNote: "Representative 12-hour stress fixture",
    stationStart: "10+0",
    stationEnd: "11+25",
    depthFeet: "55",
    fuelGallons: "400",
    cableDragFeet: "",
    hoistFeet: "",
    comments: "",
    safetyItemsFound: "",
    actionTaken: "",
    recordVersion: 2,
    operators: [{ clientId: "stress-operator-row", id: "stress-operator-row", employeeId: "stress-operator" }],
    timelineEntries: Array.from({ length: 50 }, (_, index) => ({
      clientId: `stress-timeline-${index + 1}`,
      id: `stress-timeline-${index + 1}`,
      sequence: index + 1,
      startTime: `${String(5 + Math.floor(index / 6)).padStart(2, "0")}:${String((index % 6) * 10).padStart(2, "0")}`,
      dayOffset: 0 as const,
      delayCode: index === 49 ? "13" : index % 5 === 0 ? "36" : "0",
      description: `Shift event ${index + 1}`,
      durationMinutes: index % 5 === 0 ? "10" : "",
      causesDowntime: index % 5 === 0,
    })),
    downtimeBlocks: [],
    groundChecks: ["06:20", "09:30", "12:30", "16:00"].map((startTime, index) => ({
      clientId: `stress-ground-${index + 1}`,
      id: `stress-ground-${index + 1}`,
      sequence: index + 1,
      startTime,
      dayOffset: 0 as const,
    })),
  };
}

export default async function DraglineDelayReportStressPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  if (process.env.NAM_DDR_STRESS_TEST !== "1") notFound();
  const { session = "default" } = await searchParams;
  const reportId = `stress-${session.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const initialValues = (await getStressDraft(reportId)) ?? initialStressValues();
  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Development-only DDR stability fixture</p>
        <h1>Realistic Dragline Delay Report Stress Test</h1>
      </section>
      <DraglineDelayReportForm
        action={stressDraglineFormAction}
        autosaveAction={stressDraglineAutosaveAction}
        cancelHref="/dragline-delay-reports"
        employeeOptions={[{
          id: "stress-operator",
          label: "Stress Operator",
          displayName: "Stress Operator",
          employeeCode: "TEST",
          isActive: true,
          isSupervisor: false,
        }]}
        equipmentOptions={[{
          id: "stress-dragline",
          mineId: "stress-mine",
          label: "Stress Dragline #TEST · Test Mine",
          displayName: "Stress Dragline",
          equipmentNumber: "TEST",
          status: "ACTIVE",
          mineName: "Test Mine",
          cityName: "Test City",
          cityState: "FL",
        }]}
        initialValues={initialValues}
        lakeOptions={[]}
        reportId={reportId}
        submitLabel="Save Draft"
        supervisorOptions={[]}
      />
    </main>
  );
}
