import Link from "next/link";
import { notFound } from "next/navigation";

import { updateWeeklyScheduleAction } from "@/features/work-schedule/actions";
import {
  getWeeklySchedule,
  getWorkScheduleFormOptions,
  workScheduleInitialValuesFromRecord,
} from "@/features/work-schedule/data";
import { WorkScheduleForm } from "@/features/work-schedule/WorkScheduleForm";

export const dynamic = "force-dynamic";

type EditWorkSchedulePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditWorkSchedulePage({
  params,
}: EditWorkSchedulePageProps) {
  const { id } = await params;
  const [schedule, options] = await Promise.all([
    getWeeklySchedule(id),
    getWorkScheduleFormOptions(),
  ]);

  if (!schedule) {
    notFound();
  }

  const action = updateWeeklyScheduleAction.bind(null, schedule.id);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">Edit Work Schedule</h1>
          <p className="summary">Update the weekly grid while preserving planned and actual assignment context.</p>
        </div>
        <Link className="button secondary" href={`/work-schedule/${schedule.id}`}>
          Back to Schedule
        </Link>
      </section>

      <section className="panel" aria-label="Work Schedule form">
        <WorkScheduleForm
          action={action}
          cancelHref={`/work-schedule/${schedule.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={workScheduleInitialValuesFromRecord(schedule)}
          submitLabel="Update Work Schedule"
        />
      </section>
    </main>
  );
}
