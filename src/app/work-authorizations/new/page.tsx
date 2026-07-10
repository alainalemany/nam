import { createWorkAuthorizationAction } from "@/features/work-authorizations/actions";
import { getWorkAuthorizationFormOptions } from "@/features/work-authorizations/data";
import { WorkAuthorizationForm } from "@/features/work-authorizations/WorkAuthorizationForm";

type NewWorkAuthorizationPageProps = {
  searchParams: Promise<{
    shiftReportId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function NewWorkAuthorizationPage({
  searchParams,
}: NewWorkAuthorizationPageProps) {
  const [{ shiftReportId }, options] = await Promise.all([
    searchParams,
    getWorkAuthorizationFormOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">New Work Authorization</h1>
        <p className="summary">
          Record maintenance or safety work from the correct Shift Report
          context.
        </p>
      </section>

      <section className="panel">
        <WorkAuthorizationForm
          action={createWorkAuthorizationAction}
          cancelHref="/work-authorizations"
          equipmentOptions={options.equipmentOptions}
          initialValues={{ shiftReportId }}
          mineOptions={options.mineOptions}
          shiftReportOptions={options.shiftReportOptions}
          submitLabel="Create Work Authorization"
        />
      </section>
    </main>
  );
}
