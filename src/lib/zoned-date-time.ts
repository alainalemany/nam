export const NAM_OPERATIONAL_TIME_ZONE = "America/New_York";

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

export function dateKeyInTimeZone(
  value: Date,
  timeZone = NAM_OPERATIONAL_TIME_ZONE,
) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function addDateKeyDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function zonedDateTime(
  dateKey: string,
  hour: number,
  minute = 0,
  timeZone = NAM_OPERATIONAL_TIME_ZONE,
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(targetAsUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(candidate, timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(candidate.getTime() + targetAsUtc - actualAsUtc);
  }

  return candidate;
}

export function parseZonedDateTime(
  dateKey: string,
  clockTime: string,
  timeZone = NAM_OPERATIONAL_TIME_ZONE,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Enter a valid effective date.");
  }
  const match = /^(\d{2}):(\d{2})$/.exec(clockTime);
  if (!match) throw new Error("Enter a valid effective time.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("Enter a valid effective time.");
  const result = zonedDateTime(dateKey, hour, minute, timeZone);
  const roundTrip = zonedParts(result, timeZone);
  if (
    `${roundTrip.year}-${String(roundTrip.month).padStart(2, "0")}-${String(roundTrip.day).padStart(2, "0")}` !== dateKey ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    throw new Error("That local date and time does not exist in America/New_York.");
  }
  return result;
}

export function localDateTimeInputParts(value = new Date()) {
  const parts = zonedParts(value, NAM_OPERATIONAL_TIME_ZONE);
  return {
    date: `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`,
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}
