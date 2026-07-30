const supplyRequestTimeZone = "America/New_York";

const newYorkWallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: supplyRequestTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((candidate) => candidate.type === type)?.value;
  if (!value) {
    throw new RangeError("America/New_York wall-clock formatting failed.");
  }
  return value;
}

export function supplyRequestNewYorkWallClock(now = new Date()) {
  const parts = newYorkWallClockFormatter.formatToParts(now);
  const year = part(parts, "year");
  const month = part(parts, "month");
  const day = part(parts, "day");
  const hour = part(parts, "hour");
  const minute = part(parts, "minute");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  } as const;
}

export { supplyRequestTimeZone };
