import Link from "next/link";
import { notFound } from "next/navigation";

import { updateLakeAction } from "@/features/dragline-delay-reports/lake-actions";
import { LakeForm } from "@/features/dragline-delay-reports/LakeForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditDraglineDelayReportLakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lake, mines] = await Promise.all([
    prisma.lake.findUnique({ where: { id } }),
    prisma.mine.findMany({
      include: { city: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  if (!lake) notFound();
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Dragline reference data</p><h1>Edit Lake</h1></div>
        <Link className="button secondary" href="/dragline-delay-reports/lakes">Back</Link>
      </section>
      <LakeForm
        action={updateLakeAction.bind(null, id)}
        initialValues={{
          mineId: lake.mineId,
          name: lake.name,
          status: lake.status,
          notes: lake.notes ?? "",
        }}
        mines={mines.map((mine) => ({
          id: mine.id,
          label: `${mine.name} · ${mine.city.name}${mine.status === "ACTIVE" ? "" : " · inactive"}`,
          status: mine.status,
        }))}
      />
    </main>
  );
}
