const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

function isGregorianLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isPayrollDateOnly(value: string) {
  const match = dateOnlyPattern.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;

  const daysInMonth = [
    31,
    isGregorianLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > daysInMonth[month - 1]!) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parsePayrollDateOnly(value: string) {
  if (!isPayrollDateOnly(value)) {
    throw new RangeError("Use a real calendar date in YYYY-MM-DD format.");
  }
  return new Date(`${value}T00:00:00.000Z`);
}
