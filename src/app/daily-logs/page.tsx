import Link from "next/link";

import { dailyLogActivityTypeOptions, optionLabel, shiftOptions } from "@/features/daily-logs/constants";
import { displayDateOnly } from "@/features/daily-logs/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DailyLogsPage() {
  const dailyLogs = await prisma.dailyLog.findMany({
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      primaryEquipment: true,
      activities: {
        orderBy: {
          sequence: "asc",
        },
        take: 1,
      },
    },
    orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Daily Logs</h1>
          <p className="summary">
            Workday narratives with activity timelines, equipment context, and
            mine associations.
          </p>
        </div>
        <Link className="button primary" href="/daily-logs/new">
          New Daily Log
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="daily-log-list-heading">
        <div className="section-heading">
          <h2 id="daily-log-list-heading">Daily Log records</h2>
          <span className="count-pill">{dailyLogs.length}</span>
        </div>

        {dailyLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No Daily Logs yet</h3>
            <p>
              Create the first Daily Log to begin building the date-centered
              operational history.
            </p>
            <Link className="button primary" href="/daily-logs/new">
              Add Daily Log
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Mine</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">First activity</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((dailyLog) => (
                  <tr key={dailyLog.id}>
                    <td>
                      <strong>{displayDateOnly(dailyLog.logDate)}</strong>
                      <span className="subtle">{optionLabel(shiftOptions, dailyLog.shift)}</span>
                    </td>
                    <td>{dailyLog.summary}</td>
                    <td>
                      {dailyLog.mine
                        ? `${dailyLog.mine.name}, ${dailyLog.mine.city.name}`
                        : "Not set"}
                    </td>
                    <td>{dailyLog.primaryEquipment?.displayName ?? "Not set"}</td>
                    <td>
                      {dailyLog.activities[0]
                        ? optionLabel(
                            dailyLogActivityTypeOptions,
                            dailyLog.activities[0].activityType,
                          )
                        : "None"}
                    </td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/daily-logs/${dailyLog.id}`}>
                        View
                      </Link>
                      <Link className="table-action" href={`/daily-logs/${dailyLog.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
