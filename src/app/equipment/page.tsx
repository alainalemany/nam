import Link from "next/link";

import { prisma } from "@/lib/prisma";
import {
  equipmentCategoryOptions,
  optionLabel,
  recordStatusOptions,
} from "@/features/equipment/constants";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const equipment = await prisma.equipment.findMany({
    include: {
      mine: {
        include: {
          city: true,
        },
      },
    },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Reference data</p>
          <h1 id="page-title">Equipment</h1>
          <p className="summary">
            Shared equipment records for operations, logs, schedules, fuel,
            inspections, and historical search.
          </p>
        </div>
        <Link className="button primary" href="/equipment/new">
          New Equipment
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="equipment-list-heading">
        <div className="section-heading">
          <h2 id="equipment-list-heading">Equipment records</h2>
          <span className="count-pill">{equipment.length}</span>
        </div>

        {equipment.length === 0 ? (
          <div className="empty-state">
            <h3>No equipment yet</h3>
            <p>
              Add the first dragline, work truck, or support equipment record to
              establish the shared operations reference data.
            </p>
            <Link className="button primary" href="/equipment/new">
              Add Equipment
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Equipment</th>
                  <th scope="col">Category</th>
                  <th scope="col">Mine</th>
                  <th scope="col">City</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.displayName}</strong>
                      {item.equipmentNumber ? (
                        <span className="subtle">#{item.equipmentNumber}</span>
                      ) : null}
                    </td>
                    <td>{optionLabel(equipmentCategoryOptions, item.category)}</td>
                    <td>{item.mine.name}</td>
                    <td>
                      {item.mine.city.name}
                      {item.mine.city.state ? `, ${item.mine.city.state}` : ""}
                    </td>
                    <td>{optionLabel(recordStatusOptions, item.status)}</td>
                    <td>
                      <Link className="table-action" href={`/equipment/${item.id}/edit`}>
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
