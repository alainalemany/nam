import Link from "next/link";

import { saveScheduleRangeAction } from "@/features/work-schedule/range-actions";
import {
  defaultScheduleRangeInitialValues,
  getWorkScheduleFormOptions,
} from "@/features/work-schedule/data";
import { ScheduleRangeForm } from "@/features/work-schedule/ScheduleRangeForm";

export const dynamic = "force-dynamic";

export default async function NewWorkSchedulePage() {
  const options = await getWorkScheduleFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">New Work Schedule</h1>
          <p className="summary">
            Enter one continuous schedule range. NAM keeps calendar-week records aligned behind the scenes.
          </p>
        </div>
        <Link className="button secondary" href="/work-schedule">
          Back to Work Schedule
        </Link>
      </section>

      <section className="panel" aria-label="Work Schedule form">
        <ScheduleRangeForm
          action={saveScheduleRangeAction}
          cancelHref="/work-schedule"
          employeeOptions={options.employeeOptions}
          equipmentOptions={options.equipmentOptions}
          initialValues={defaultScheduleRangeInitialValues(undefined, undefined, options.defaultPrimaryEmployeeId)}
          supervisorOptions={options.supervisorOptions}
        />
      </section>
    </main>
  );
}
