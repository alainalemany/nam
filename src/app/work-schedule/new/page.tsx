import Link from "next/link";

import { createWeeklyScheduleAction } from "@/features/work-schedule/actions";
import {
  defaultWorkScheduleInitialValues,
  getWorkScheduleFormOptions,
} from "@/features/work-schedule/data";
import { WorkScheduleForm } from "@/features/work-schedule/WorkScheduleForm";

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
            Build a Monday-Sunday schedule while preserving planned and actual values separately.
          </p>
        </div>
        <Link className="button secondary" href="/work-schedule">
          Back to Work Schedule
        </Link>
      </section>

      <section className="panel" aria-label="Work Schedule form">
        <WorkScheduleForm
          action={createWeeklyScheduleAction}
          cancelHref="/work-schedule"
          equipmentOptions={options.equipmentOptions}
          initialValues={defaultWorkScheduleInitialValues()}
          submitLabel="Save Work Schedule"
        />
      </section>
    </main>
  );
}
