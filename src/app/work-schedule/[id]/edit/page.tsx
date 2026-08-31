import Link from "next/link";
import { notFound } from "next/navigation";

import { updateWeeklyScheduleAction } from "@/features/work-schedule/actions";
import {
  loadScheduleRangeAssignmentsAction,
  saveScheduleRangeAction,
} from "@/features/work-schedule/range-actions";
import {
  getWeeklySchedule,
  getWorkScheduleFormOptions,
  scheduleRangeInitialValuesFromRecord,
  workScheduleInitialValuesFromRecord,
} from "@/features/work-schedule/data";
import { MAX_SCHEDULE_RANGE_DAYS } from "@/features/work-schedule/range-validation";
import { ScheduleRangeForm } from "@/features/work-schedule/ScheduleRangeForm";
import { WorkScheduleForm } from "@/features/work-schedule/WorkScheduleForm";
import {
  buildDateRange,
  isValidDateOnlyString,
  parseDateOnly,
} from "@/features/work-schedule/validation";

export const dynamic = "force-dynamic";

type EditWorkSchedulePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditWorkSchedulePage({
  params,
  searchParams,
}: EditWorkSchedulePageProps) {
  const { id } = await params;
  const schedule = await getWeeklySchedule(id);

  if (!schedule) {
    notFound();
  }

  const query = await searchParams;
  const requestedStartDate = typeof query?.startDate === "string" ? query.startDate : undefined;
  const requestedEndDate = typeof query?.endDate === "string" ? query.endDate : undefined;
  const requestedDates = requestedStartDate && requestedEndDate &&
    isValidDateOnlyString(requestedStartDate) &&
    isValidDateOnlyString(requestedEndDate)
    ? buildDateRange(parseDateOnly(requestedStartDate), parseDateOnly(requestedEndDate))
    : [];
  const selectedRange = requestedStartDate && requestedEndDate &&
    requestedDates.length > 0 && requestedDates.length <= MAX_SCHEDULE_RANGE_DAYS
    ? { startDate: requestedStartDate, endDate: requestedEndDate }
    : undefined;
  const rangeInitialValues = schedule.primaryEmployeeId
    ? await scheduleRangeInitialValuesFromRecord(schedule, selectedRange)
    : undefined;

  const existingEmployeeIds = [
    schedule.primaryEmployeeId,
    schedule.assignedByEmployeeId,
    ...schedule.assignments.flatMap((assignment) =>
      assignment.crewMembers.map((member) => member.employeeId),
    ),
    ...(rangeInitialValues?.assignments.flatMap((assignment) => [
      assignment.plannedPrimaryEmployeeId,
      assignment.plannedPartnerEmployeeId,
      assignment.actualPrimaryEmployeeId,
      assignment.actualPartnerEmployeeId,
    ]) ?? []),
  ].filter((employeeId): employeeId is string => Boolean(employeeId));
  const options = await getWorkScheduleFormOptions(
    existingEmployeeIds,
    schedule.assignedByEmployeeId ?? undefined,
  );

  const action = updateWeeklyScheduleAction.bind(null, schedule.id);
  const loadAssignments = schedule.primaryEmployeeId
    ? loadScheduleRangeAssignmentsAction.bind(null, schedule.primaryEmployeeId)
    : undefined;

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
        {rangeInitialValues && loadAssignments ? (
          <ScheduleRangeForm
            action={saveScheduleRangeAction}
            cancelHref={`/work-schedule/${schedule.id}`}
            employeeOptions={options.employeeOptions}
            equipmentOptions={options.equipmentOptions}
            initialValues={rangeInitialValues}
            loadAssignments={loadAssignments}
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
