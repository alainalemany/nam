import { notFound } from "next/navigation";

import { updateDailyLogAction } from "@/features/daily-logs/actions";
import { dateInputValue, getDailyLogFormOptions } from "@/features/daily-logs/data";
import { DailyLogForm } from "@/features/daily-logs/DailyLogForm";
import { prisma } from "@/lib/prisma";

type EditDailyLogPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditDailyLogPage({ params }: EditDailyLogPageProps) {
  const { id } = await params;
  const [dailyLog, options] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: {
            sequence: "asc",
          },
        },
      },
    }),
    getDailyLogFormOptions(),
  ]);

  if (!dailyLog) {
    notFound();
  }

  const updateAction = updateDailyLogAction.bind(null, dailyLog.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Edit Daily Log</h1>
        <p className="summary">
          Update the workday summary and activity timeline.
        </p>
      </section>

      <section className="panel">
        <DailyLogForm
          action={updateAction}
          cancelHref={`/daily-logs/${dailyLog.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={{
            logDate: dateInputValue(dailyLog.logDate),
            shift: dailyLog.shift,
            mineId: dailyLog.mineId ?? "",
            primaryEquipmentId: dailyLog.primaryEquipmentId ?? "",
            summary: dailyLog.summary ?? "",
            weatherConditions: dailyLog.weatherConditions ?? "",
            generalNotes: dailyLog.generalNotes ?? "",
            activities: dailyLog.activities.map((activity) => ({
              activityType: activity.activityType,
              title: activity.title,
              startTime: activity.startTime ?? "",
              endTime: activity.endTime ?? "",
              description: activity.description ?? "",
              equipmentId: activity.equipmentId ?? "",
              location: activity.location ?? "",
              contractorCompany: activity.contractorCompany ?? "",
              personName: activity.personName ?? "",
              notes: activity.notes ?? "",
            })),
          }}
          mineOptions={options.mineOptions}
          submitLabel="Save Daily Log"
        />
      </section>
    </main>
  );
}
