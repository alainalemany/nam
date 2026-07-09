import { notFound } from "next/navigation";

import { updateStopCardAction } from "@/features/stop-cards/actions";
import { dateInputValue, getStopCardFormOptions } from "@/features/stop-cards/data";
import { StopCardForm } from "@/features/stop-cards/StopCardForm";
import { prisma } from "@/lib/prisma";

type EditStopCardPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditStopCardPage({ params }: EditStopCardPageProps) {
  const { id } = await params;
  const [stopCard, options] = await Promise.all([
    prisma.stopCard.findUnique({
      where: { id },
    }),
    getStopCardFormOptions(),
  ]);

  if (!stopCard) {
    notFound();
  }

  const updateAction = updateStopCardAction.bind(null, stopCard.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Safety</p>
        <h1 id="page-title">Edit STOP Card</h1>
        <p className="summary">
          Update the safety observation, status, severity, or corrective action.
        </p>
      </section>

      <section className="panel">
        <StopCardForm
          action={updateAction}
          cancelHref={`/stop-cards/${stopCard.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={{
            observationDate: dateInputValue(stopCard.observationDate),
            category: stopCard.category,
            severity: stopCard.severity,
            status: stopCard.status,
            mineId: stopCard.mineId ?? "",
            equipmentId: stopCard.equipmentId ?? "",
            location: stopCard.location ?? "",
            description: stopCard.description,
            correctiveAction: stopCard.correctiveAction ?? "",
            createdBy: stopCard.createdBy ?? "",
          }}
          mineOptions={options.mineOptions}
          submitLabel="Save STOP Card"
        />
      </section>
    </main>
  );
}
