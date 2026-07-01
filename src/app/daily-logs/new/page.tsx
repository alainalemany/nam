import { createDailyLogAction } from "@/features/daily-logs/actions";
import { getDailyLogFormOptions } from "@/features/daily-logs/data";
import { DailyLogForm } from "@/features/daily-logs/DailyLogForm";

export const dynamic = "force-dynamic";

export default async function NewDailyLogPage() {
  const { equipmentOptions, mineOptions } = await getDailyLogFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">New Daily Log</h1>
        <p className="summary">
          Record the workday summary and add one or more activity entries.
          Activity dates inherit the parent Daily Log date.
        </p>
      </section>

      <section className="panel">
        <DailyLogForm
          action={createDailyLogAction}
          cancelHref="/daily-logs"
          equipmentOptions={equipmentOptions}
          mineOptions={mineOptions}
          submitLabel="Create Daily Log"
        />
      </section>
    </main>
  );
}
