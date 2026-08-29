import { cityDisplayLabel } from "@/features/geography/normalization";
import { prisma } from "@/lib/prisma";

import { buildEquipmentWhere, type EquipmentFilters } from "./filters";

export async function getEquipment(filters: EquipmentFilters = {}) {
  return prisma.equipment.findMany({
    where: buildEquipmentWhere(filters),
    include: {
      mine: {
        include: {
          city: { include: { stateReference: true } },
        },
      },
    },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });
}

export async function getEquipmentMineOptions(includeInactive = false) {
  const mines = await prisma.mine.findMany({
    where: includeInactive ? undefined : { status: "ACTIVE" },
    include: { city: { include: { stateReference: true } } },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  });

  return mines.map((mine) => ({
    id: mine.id,
    label: `${mine.name} (${cityDisplayLabel(mine.city)})`,
    cityLabel: cityDisplayLabel(mine.city),
    mineType: mine.type,
    status: mine.status,
  }));
}
