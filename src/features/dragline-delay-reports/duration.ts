export function formatDraglineDurationMinutes(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(
      "Dragline duration must be a nonnegative whole number of minutes.",
    );
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return remainingMinutes === 0 ? "0 h" : `${remainingMinutes} min`;
  }
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
