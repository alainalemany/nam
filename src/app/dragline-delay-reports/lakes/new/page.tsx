import Link from "next/link";

import { createLakeAction } from "@/features/dragline-delay-reports/lake-actions";
import { LakeForm } from "@/features/dragline-delay-reports/LakeForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewDraglineDelayReportLakePage() {
  const mines = await prisma.mine.findMany({
    where: { status: "ACTIVE" },
    include: { city: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Dragline reference data</p><h1>Add Lake</h1></div>
        <Link className="button secondary" href="/dragline-delay-reports/lakes">Back</Link>
      </section>
      <LakeForm
        action={createLakeAction}
        mines={mines.map((mine) => ({
          id: mine.id,
          label: `${mine.name} · ${mine.city.name}`,
          status: mine.status,
        }))}
      />
    </main>
  );
}
