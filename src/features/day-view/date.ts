export type DayViewSearchParams = Record<string, string | string[] | undefined>;

export type DayViewDateState = {
  nextDate: string;
  previousDate: string;
  selectedDate: string;
  today: string;
};

const dayViewPath = "/day-view";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayViewOperationalTimeZone = "America/New_York";
const localDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: dayViewOperationalTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function padDateComponent(value: number) {
  return String(value).padStart(2, "0");
}

function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function utcDateKey(value: Date) {
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${padDateComponent(value.getUTCMonth() + 1)}-${padDateComponent(value.getUTCDate())}`;
}

export function parseDayViewDateKey(value: string | string[] | undefined) {
  if (!value || Array.isArray(value) || !datePattern.test(value)) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1) return undefined;

  const parsed = calendarDate(year, month, day);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return value;
}

export function todayDayViewDate(now = new Date()) {
  const parts = localDateFormatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return `${String(year).padStart(4, "0")}-${padDateComponent(month)}-${padDateComponent(day)}`;
}

export function shiftDayViewDate(value: string, days: number) {
  const canonical = parseDayViewDateKey(value);
  if (!canonical || !Number.isInteger(days)) {
    throw new RangeError("Day View navigation requires a valid date and whole-day offset.");
  }

  const [year, month, day] = canonical.split("-").map(Number);
  const date = calendarDate(year, month, day);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
}

export function dayViewHref(date: string) {
  return `${dayViewPath}?date=${encodeURIComponent(date)}`;
}

export function parseDayViewDate(
  searchParams: DayViewSearchParams,
  now = new Date(),
): DayViewDateState {
  const today = todayDayViewDate(now);
  const selectedDate = parseDayViewDateKey(searchParams.date) ?? today;

  return {
    selectedDate,
    previousDate: shiftDayViewDate(selectedDate, -1),
    nextDate: shiftDayViewDate(selectedDate, 1),
    today,
  };
}
