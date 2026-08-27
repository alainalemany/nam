import { prisma } from "@/lib/prisma";

import { buildEquipmentWhere, type EquipmentFilters } from "./filters";

export async function getEquipment(filters: EquipmentFilters = {}) {
  return prisma.equipment.findMany({
    where: buildEquipmentWhere(filters),
    include: {
      mine: {
        include: {
          city: true,
        },
      },
    },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });
}

export async function getEquipmentMineOptions(includeInactive = false) {
  const mines = await prisma.mine.findMany({
    where: includeInactive ? undefined : { status: "ACTIVE" },
    include: { city: true },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
  });

  return mines.map((mine) => ({
    id: mine.id,
    label: `${mine.name} (${mine.city.name}${
      mine.city.state ? `, ${mine.city.state}` : ""
    })`,
    cityLabel: `${mine.city.name}${mine.city.state ? `, ${mine.city.state}` : ""}`,
    mineType: mine.type,
    status: mine.status,
  }));
}
