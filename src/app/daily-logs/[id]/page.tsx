import Link from "next/link";
import { notFound } from "next/navigation";

import { dailyLogActivityTypeOptions, optionLabel, shiftOptions } from "@/features/daily-logs/constants";
import { displayDateOnly } from "@/features/daily-logs/data";
import { prisma } from "@/lib/prisma";

type DailyLogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DailyLogDetailPage({ params }: DailyLogDetailPageProps) {
  const { id } = await params;
  const dailyLog = await prisma.dailyLog.findUnique({
    where: { id },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      primaryEquipment: true,
      activities: {
        include: {
          equipment: true,
        },
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  if (!dailyLog) {
    notFound();
  }

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Daily Log</p>
          <h1 id="page-title">{displayDateOnly(dailyLog.logDate)}</h1>
          <p className="summary">{dailyLog.summary}</p>
        </div>
        <Link className="button primary" href={`/daily-logs/${dailyLog.id}/edit`}>
          Edit Daily Log
        </Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="context-heading">
        <div>
          <p className="eyebrow">Shift</p>
          <h2 id="context-heading">{optionLabel(shiftOptions, dailyLog.shift)}</h2>
        </div>
        <div>
          <p className="eyebrow">Mine</p>
          <p>
            {dailyLog.mine
              ? `${dailyLog.mine.name}, ${dailyLog.mine.city.name}`
              : "Not set"}
          </p>
        </div>
        <div>
          <p className="eyebrow">Primary equipment</p>
          <p>{dailyLog.primaryEquipment?.displayName ?? "Not set"}</p>
        </div>
        <div>
          <p className="eyebrow">Weather</p>
          <p>{dailyLog.weatherConditions ?? "Not recorded"}</p>
        </div>
      </section>

      {dailyLog.generalNotes ? (
        <section className="panel" aria-labelledby="notes-heading">
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="notes-heading">General notes</h2>
            <p>{dailyLog.generalNotes}</p>
          </div>
        </section>
      ) : null}

      <section className="panel table-panel" aria-labelledby="timeline-heading">
        <div className="section-heading">
          <h2 id="timeline-heading">Activity timeline</h2>
          <span className="count-pill">{dailyLog.activities.length}</span>
        </div>

        <div className="timeline">
          {dailyLog.activities.map((activity) => (
            <article className="timeline-item" key={activity.id}>
              <div className="timeline-time">
                {activity.startTime ?? "Time not set"}
                {activity.endTime ? ` - ${activity.endTime}` : ""}
              </div>
              <div>
                <p className="eyebrow">
                  {optionLabel(dailyLogActivityTypeOptions, activity.activityType)}
                </p>
                <h3>{activity.title}</h3>
                {activity.description ? <p>{activity.description}</p> : null}
                <dl className="meta-list">
                  {activity.equipment ? (
                    <>
                      <dt>Equipment</dt>
                      <dd>{activity.equipment.displayName}</dd>
                    </>
                  ) : null}
                  {activity.location ? (
                    <>
                      <dt>Location</dt>
                      <dd>{activity.location}</dd>
                    </>
                  ) : null}
                  {activity.contractorCompany ? (
                    <>
                      <dt>Company</dt>
                      <dd>{activity.contractorCompany}</dd>
                    </>
                  ) : null}
                  {activity.personName ? (
                    <>
                      <dt>Person</dt>
                      <dd>{activity.personName}</dd>
                    </>
                  ) : null}
                </dl>
                {activity.notes ? <p className="subtle">{activity.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
