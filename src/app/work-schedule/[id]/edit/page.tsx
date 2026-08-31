import Link from "next/link";
import { notFound } from "next/navigation";

import { updateWeeklyScheduleAction } from "@/features/work-schedule/actions";
import { saveScheduleRangeAction } from "@/features/work-schedule/range-actions";
import {
  getWeeklySchedule,
  getWorkScheduleFormOptions,
  scheduleRangeInitialValuesFromRecord,
  workScheduleInitialValuesFromRecord,
} from "@/features/work-schedule/data";
import { ScheduleRangeForm } from "@/features/work-schedule/ScheduleRangeForm";
import { WorkScheduleForm } from "@/features/work-schedule/WorkScheduleForm";

export const dynamic = "force-dynamic";

type EditWorkSchedulePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditWorkSchedulePage({
  params,
}: EditWorkSchedulePageProps) {
  const { id } = await params;
  const schedule = await getWeeklySchedule(id);

  if (!schedule) {
    notFound();
  }

  const existingEmployeeIds = [
    schedule.primaryEmployeeId,
    schedule.assignedByEmployeeId,
    ...schedule.assignments.flatMap((assignment) =>
      assignment.crewMembers.map((member) => member.employeeId),
    ),
  ].filter((employeeId): employeeId is string => Boolean(employeeId));
  const options = await getWorkScheduleFormOptions(
    existingEmployeeIds,
    schedule.assignedByEmployeeId ?? undefined,
  );

  const action = updateWeeklyScheduleAction.bind(null, schedule.id);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">Edit Work Schedule</h1>
          <p className="summary">Update a continuous date range while preserving weekly storage and assignment history.</p>
        </div>
        <Link className="button secondary" href={`/work-schedule/${schedule.id}`}>
          Back to Schedule
        </Link>
      </section>

      <section className="panel" aria-label="Work Schedule form">
        {schedule.primaryEmployeeId ? (
          <ScheduleRangeForm
            action={saveScheduleRangeAction}
            cancelHref={`/work-schedule/${schedule.id}`}
            employeeOptions={options.employeeOptions}
            equipmentOptions={options.equipmentOptions}
            initialValues={scheduleRangeInitialValuesFromRecord(schedule)}
            supervisorOptions={options.supervisorOptions}
          />
        ) : (
          <WorkScheduleForm
            action={action}
            cancelHref={`/work-schedule/${schedule.id}`}
            employeeOptions={options.employeeOptions}
            equipmentOptions={options.equipmentOptions}
            initialValues={workScheduleInitialValuesFromRecord(schedule)}
            submitLabel="Update Work Schedule"
            supervisorOptions={options.supervisorOptions}
          />
        )}
      </section>
    </main>
  );
}
