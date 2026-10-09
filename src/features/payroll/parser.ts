import { createHash } from "node:crypto";

import { PDFParse } from "pdf-parse";

import { MAX_PAYSLIP_BYTES, PAYROLL_PARSER_VERSION } from "./constants";
import type { ParsedPaycheck } from "./types";

type WorkdayTable = string[][];

type WorkdayLayout = {
  tables?: WorkdayTable[];
};

const DATE_TOKEN = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g;

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isoDate(month: string, day: string, year: string) {
  const yyyy = year.length === 2 ? `20${year}` : year;
  const value = `${yyyy}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? value : "";
}

function dateAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}[^\\d]{0,30}(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{2,4})`, "i"),
    );
    if (match) return isoDate(match[1], match[2], match[3]);
  }
  return "";
}

function dateIn(value?: string) {
  const match = value?.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  return match ? isoDate(match[1], match[2], match[3]) : "";
}

function decimal(value?: string) {
  if (!value) return "";
  const normalized = value.replace(/[$,\s]/g, "").trim();
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? normalized : "";
}

function amountIn(value?: string) {
  const match = value?.match(/\(?[-$]?\s*[\d,]+(?:\.\d{1,4})?\)?/);
  if (!match) return "";
  const negative = match[0].startsWith("(") && match[0].endsWith(")");
  const parsed = decimal(match[0].replace(/[()]/g, ""));
  return negative && parsed ? `-${parsed.replace(/^-/, "")}` : parsed;
}

function amountAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label}[^\\d$()-]{0,36}(\\(?[-$]?[\\d,]+(?:\\.\\d{1,4})?\\)?)`, "i"),
    );
    if (match) {
      const negative = match[1].startsWith("(") && match[1].endsWith(")");
      const value = decimal(match[1].replace(/[()]/g, ""));
      return negative && value ? `-${value.replace(/^-/, "")}` : value;
    }
  }
  return "";
}

function componentLine(text: string, label: RegExp) {
  for (const line of text.split("\n").map((value) => value.trim())) {
    const match = line.match(label);
    if (match?.index != null) return line.slice(match.index + match[0].length).trim();
  }
  return undefined;
}

function lineNumbers(line?: string) {
  const withoutDates = line?.replace(DATE_TOKEN, " ");
  return (withoutDates?.match(/-?\$?[\d,]+(?:\.\d+)?/g) ?? []).map(decimal).filter(Boolean);
}

function firstLikelyHours(line?: string) {
  const values = lineNumbers(line);
  return values.find((value) => {
    const number = Number(value);
    return number >= 0 && number <= 168;
  }) ?? "";
}

function likelyRate(line?: string, hours?: string) {
  const values = lineNumbers(line);
  const start = hours ? values.indexOf(hours) + 1 : 0;
  return values.slice(start).find((value) => Number(value) > 0 && Number(value) < 500) ?? "";
}

function likelyCurrentAmount(line: string | undefined, hasYtdColumn: boolean, afterIndex = -1) {
  const values = lineNumbers(line);
  const amountIndex = hasYtdColumn ? values.length - 2 : values.length - 1;
  return amountIndex > afterIndex ? (values[amountIndex] ?? "") : "";
}

function sumKnown(text: string, labels: RegExp[], hasYtdColumn: boolean) {
  return labels.reduce(
    (sum, label) => sum + Number(likelyCurrentAmount(componentLine(text, label), hasYtdColumn) || 0),
    0,
  );
}

function tableValueBelow(
  tables: WorkdayTable[],
  labels: RegExp[],
  parseValue: (value?: string) => string,
) {
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.length - 1; rowIndex += 1) {
      const row = table[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const label = row[columnIndex].replace(/\s+/g, " ").trim();
        if (!labels.some((candidate) => candidate.test(label))) continue;
        const parsed = parseValue(table[rowIndex + 1]?.[columnIndex]);
        if (parsed) return parsed;
      }
    }
  }
  return "";
}

export function parseWorkdayPaycheckText(
  sourceText: string,
  fingerprint = "manual-review",
  layout: WorkdayLayout = {},
): ParsedPaycheck {
  const text = normalizeText(sourceText);
  const tables = layout.tables ?? [];
  const hasYtdColumn = /\bYTD\b/i.test(text);
  const regularLine = componentLine(text, /\bREGULAR\b/i);
  const overtimeBaseLine = componentLine(text, /overtime\s*1(?:\.0)?x/i);
  const overtimePremiumLine = componentLine(text, /overtime\s*(?:premium\s*)?(?:-|–)?\s*0?\.5x/i);
  const regularHours = firstLikelyHours(regularLine);
  const overtimeBaseHours = firstLikelyHours(overtimeBaseLine);
  const overtimePremiumHours = firstLikelyHours(overtimePremiumLine);
  const overtimeHours = overtimeBaseHours || overtimePremiumHours;
  const baseRate = likelyRate(regularLine, regularHours);
  const regularEarnings = likelyCurrentAmount(
    regularLine,
    hasYtdColumn,
    regularHours && baseRate ? 1 : -1,
  );
  const overtimeBaseEarnings = likelyCurrentAmount(
    overtimeBaseLine,
    hasYtdColumn,
    overtimeBaseHours && likelyRate(overtimeBaseLine, overtimeBaseHours) ? 1 : -1,
  );
  const overtimePremiumEarnings = likelyCurrentAmount(
    overtimePremiumLine,
    hasYtdColumn,
    overtimePremiumHours && likelyRate(overtimePremiumLine, overtimePremiumHours) ? 1 : -1,
  );
  const noncashImputed = sumKnown(
    text,
    [/\bimputed\s+gtl\b/i, /\bimputed\s+ltd\b/i],
    hasYtdColumn,
  );

  const warnings: string[] = [];
  const periodStart =
    tableValueBelow(tables, [/^(?:pay )?period (?:begin|start)(?: date)?$/i], dateIn) ||
    dateAfter(text, ["Pay Period Begin", "Period Start", "Period Beginning"]);
  const periodEnd =
    tableValueBelow(tables, [/^(?:pay )?period end(?:ing)?(?: date)?$/i], dateIn) ||
    dateAfter(text, ["Pay Period End", "Period End", "Period Ending"]);
  const checkDate =
    tableValueBelow(tables, [/^(?:check|payment|pay) date$/i], dateIn) ||
    dateAfter(text, ["Check Date", "Payment Date", "Pay Date"]);
  const grossCashPay =
    tableValueBelow(tables, [/^gross(?: cash)? pay$/i], amountIn) ||
    amountAfter(text, ["Gross Cash Pay", "Gross Pay"]);
  const netPay =
    tableValueBelow(tables, [/^net pay$/i], amountIn) || amountAfter(text, ["Net Pay"]);
  const employeeTaxes =
    tableValueBelow(tables, [/^(?:employee|total) taxes$/i], amountIn) ||
    amountAfter(text, ["Employee Taxes", "Total Taxes"]);
  const preTaxDeductions =
    tableValueBelow(tables, [/^pre[ -]?tax deductions?$/i], amountIn) ||
    amountAfter(text, ["Pre Tax Deductions", "Pre-Tax Deductions"]);
  const postTaxDeductions =
    tableValueBelow(tables, [/^post[ -]?tax deductions?$/i], amountIn) ||
    amountAfter(text, ["Post Tax Deductions", "Post-Tax Deductions"]);

  if (!periodStart || !periodEnd || !checkDate) {
    warnings.push("Confirm the payroll period and official check date.");
  }
  if (!regularHours && !overtimeHours) {
    warnings.push("Paid hours were not confidently identified; enter them manually.");
  }
  if (
    (regularHours && !regularEarnings) ||
    (overtimeHours && (!overtimeBaseEarnings || !overtimePremiumEarnings))
  ) {
    warnings.push("Current-period earnings were not confidently identified; review required.");
  }
  if (overtimeBaseHours && overtimePremiumHours && overtimeBaseHours !== overtimePremiumHours) {
    warnings.push("Overtime 1X and 0.5X components report different hours; review required.");
  }
  if (!grossCashPay || !netPay) {
    warnings.push("Gross cash pay or net pay was not confidently identified.");
  }
  const parsedCashComponents =
    Number(regularEarnings || 0) +
    Number(overtimeBaseEarnings || 0) +
    Number(overtimePremiumEarnings || 0);
  if (
    grossCashPay &&
    parsedCashComponents > 0 &&
    Math.abs(Number(grossCashPay) - parsedCashComponents) > 0.01
  ) {
    warnings.push("Parsed cash earnings do not equal gross cash pay; classify other cash earnings before saving.");
  }
  const parsedNet =
    Number(grossCashPay || 0) -
    Number(preTaxDeductions || 0) -
    Number(employeeTaxes || 0) -
    Number(postTaxDeductions || 0);
  if (grossCashPay && netPay && Math.abs(parsedNet - Number(netPay)) > 0.01) {
    warnings.push("Gross cash pay less parsed deductions and taxes does not equal net pay; review unclassified deductions.");
  }

  return {
    fingerprint,
    parserVersion: PAYROLL_PARSER_VERSION,
    periodStart,
    periodEnd,
    checkDate,
    regularHours,
    overtimeHours,
    baseRate,
    regularEarnings,
    overtimeBaseEarnings,
    overtimePremiumEarnings,
    otherCashEarnings: "0.00",
    grossCashPay,
    noncashImputedEarnings: noncashImputed ? noncashImputed.toFixed(2) : "0.00",
    preTaxDeductions: preTaxDeductions || "0.00",
    employeeTaxes: employeeTaxes || "0.00",
    postTaxDeductions: postTaxDeductions || "0.00",
    adjustments: "0.00",
    netPay,
    notes: "",
    warnings,
  };
}

export async function extractPaycheckPdf(file: File) {
  if (file.size <= 0 || file.size > MAX_PAYSLIP_BYTES) {
    throw new Error("Choose a non-empty PDF no larger than 10 MB.");
  }
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const magic = new TextDecoder("ascii").decode(sourceBytes.slice(0, 5));
  if (magic !== "%PDF-") throw new Error("The selected file is not a valid PDF.");
  const fingerprint = createHash("sha256").update(sourceBytes).digest("hex");
  const parserBytes = sourceBytes.slice();
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: parserBytes });
    const result = await parser.getText();
    const tableResult = await parser.getTable().catch(() => undefined);
    const values = parseWorkdayPaycheckText(result.text, fingerprint, {
      tables: tableResult?.pages?.flatMap((page) => page.tables) ?? tableResult?.mergedTables,
    });
    if (!result.text.trim()) {
      values.warnings.push("No readable text was found. Enter the paycheck values manually.");
    }
    return values;
  } finally {
    try {
      await parser?.destroy();
    } catch {
      // Cleanup must not replace a successful extraction or the original parse error.
    }
    try {
      sourceBytes.fill(0);
    } catch {
      // Best-effort cleanup only; transferred buffers may already be detached.
    }
    try {
      parserBytes.fill(0);
    } catch {
      // pdf-parse may transfer and detach its input buffer during processing.
    }
  }
}
