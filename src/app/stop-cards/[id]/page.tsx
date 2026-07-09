import Link from "next/link";
import { notFound } from "next/navigation";

import {
  optionLabel,
  stopCardCategoryOptions,
  stopCardSeverityOptions,
  stopCardStatusOptions,
} from "@/features/stop-cards/constants";
import { displayDateOnly } from "@/features/stop-cards/data";
import { prisma } from "@/lib/prisma";

type StopCardDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StopCardDetailPage({ params }: StopCardDetailPageProps) {
  const { id } = await params;
  const stopCard = await prisma.stopCard.findUnique({
    where: { id },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
  });

  if (!stopCard) {
    notFound();
  }

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">STOP Card</p>
          <h1 id="page-title">{displayDateOnly(stopCard.observationDate)}</h1>
          <p className="summary">{stopCard.description}</p>
        </div>
        <Link className="button primary" href={`/stop-cards/${stopCard.id}/edit`}>
          Edit STOP Card
        </Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="context-heading">
        <div>
          <p className="eyebrow">Category</p>
          <h2 id="context-heading">
            {optionLabel(stopCardCategoryOptions, stopCard.category)}
          </h2>
        </div>
        <div>
          <p className="eyebrow">Severity</p>
          <p>{optionLabel(stopCardSeverityOptions, stopCard.severity)}</p>
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p>{optionLabel(stopCardStatusOptions, stopCard.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Created by</p>
          <p>{stopCard.createdBy ?? "Not recorded"}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="location-heading">
        <div>
          <p className="eyebrow">Mine</p>
          <h2 id="location-heading">
            {stopCard.mine
              ? `${stopCard.mine.name}, ${stopCard.mine.city.name}`
              : "Not set"}
          </h2>
        </div>
        <div>
          <p className="eyebrow">Equipment</p>
          <p>{stopCard.equipment?.displayName ?? "Not set"}</p>
        </div>
        <div>
          <p className="eyebrow">Location</p>
          <p>{stopCard.location ?? "Not recorded"}</p>
        </div>
      </section>

      <section className="panel" aria-labelledby="action-heading">
        <div>
          <p className="eyebrow">Corrective action</p>
          <h2 id="action-heading">Action noted</h2>
          <p>{stopCard.correctiveAction ?? "No corrective action recorded."}</p>
        </div>
      </section>
    </main>
  );
}
