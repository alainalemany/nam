import Link from "next/link";

import { createDraglineDelayReportAction } from "@/features/dragline-delay-reports/actions";
import { getDraglineDelayReportFormOptions } from "@/features/dragline-delay-reports/data";
import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import { localOperationalDateValue } from "@/features/dragline-delay-reports/time";
import type { DraglineDelayReportFormInitialValues } from "@/features/dragline-delay-reports/types";

export const dynamic = "force-dynamic";

export default async function NewDraglineDelayReportPage() {
  const { equipment, employees, supervisors } =
    await getDraglineDelayReportFormOptions();
  const initialValues: DraglineDelayReportFormInitialValues = {
    operationalWorkDate: localOperationalDateValue(),
    shift: "DAY",
    equipmentId: "",
    startingHourMeter: "",
    endingHourMeter: "",
    supervisorId: "",
    operators: [],
    timelineEntries: [],
  };

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">DDR-1 · Draft</p>
          <h1>Create Dragline Delay Report</h1>
          <p className="summary">
            Start one report for one Dragline, operational work date, and Day or
            Night shift; save it repeatedly throughout the shift.
          </p>
        </div>
        <Link className="button secondary" href="/dragline-delay-reports">
          Back
        </Link>
      </section>
      <DraglineDelayReportForm
        action={createDraglineDelayReportAction}
        cancelHref="/dragline-delay-reports"
        employeeOptions={employees}
        equipmentOptions={equipment}
        initialValues={initialValues}
        submitLabel="Save Draft Report"
        supervisorOptions={supervisors}
      />
    </main>
  );
}
