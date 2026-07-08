export type DayViewSearchParams = Record<string, string | string[] | undefined>;

export type DayViewDateState = {
  nextDate: string;
  previousDate: string;
  selectedDate: string;
  today: string;
};

const dayViewPath = "/day-view";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function cleanDate(value: string | string[] | undefined) {
  const first = firstValue(value);

  if (!first) {
    return undefined;
  }

  const trimmed = first.trim();
  return datePattern.test(trimmed) ? trimmed : undefined;
}

export function todayDayViewDate(now = new Date()) {
  return dateValue(now);
}

export function shiftDayViewDate(value: string, days: number) {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateValue(date);
}

export function dayViewHref(date: string) {
  return `${dayViewPath}?date=${encodeURIComponent(date)}`;
}

export function parseDayViewDate(
  searchParams: DayViewSearchParams,
  now = new Date(),
): DayViewDateState {
  const today = todayDayViewDate(now);
  const selectedDate = cleanDate(searchParams.date) ?? today;

  return {
    selectedDate,
    previousDate: shiftDayViewDate(selectedDate, -1),
    nextDate: shiftDayViewDate(selectedDate, 1),
    today,
  };
}
