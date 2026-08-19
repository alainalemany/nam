import type { DraglineLakeOption } from "./types";

export function filterDraglineLakesForMine(
  lakes: DraglineLakeOption[],
  mineId: string | undefined,
  selectedLakeId?: string,
) {
  if (!mineId) return [];
  return lakes.filter(
    (lake) =>
      lake.mineId === mineId &&
      (lake.status === "ACTIVE" || lake.id === selectedLakeId),
  );
}
