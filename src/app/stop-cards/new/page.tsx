import { createStopCardAction } from "@/features/stop-cards/actions";
import { getStopCardFormOptions } from "@/features/stop-cards/data";
import { StopCardForm } from "@/features/stop-cards/StopCardForm";

export const dynamic = "force-dynamic";

export default async function NewStopCardPage() {
  const { equipmentOptions, mineOptions } = await getStopCardFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Safety</p>
        <h1 id="page-title">New STOP Card</h1>
        <p className="summary">
          Record a safety observation, its severity, current status, and any
          corrective action.
        </p>
      </section>

      <section className="panel">
        <StopCardForm
          action={createStopCardAction}
          cancelHref="/stop-cards"
          equipmentOptions={equipmentOptions}
          mineOptions={mineOptions}
          submitLabel="Create STOP Card"
        />
      </section>
    </main>
  );
}
