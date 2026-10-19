import { createHash } from "node:crypto";

import type { PDFParse as PDFParseInstance } from "pdf-parse";

import { MAX_PAYSLIP_BYTES, PAYROLL_PARSER_VERSION } from "./constants";
import {
  assessRegularRateConsistency,
  decimalHoursToMinutes,
  normalizedDecimalKey,
  positiveDecimal,
  sumDecimalValues,
} from "./rate-extraction";
import type {
  ParsedPaycheck,
  PayrollExtractionIssue,
  PayrollExtractionIssueCode,
  PayrollExtractionIssueSeverity,
  RateExtractionResult,
  RegularRateObservation,
} from "./types";

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
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : "";
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
      new RegExp(`${label}[^\\n\\d$()-]{0,36}(\\(?[-$]?[\\d,]+(?:\\.\\d{1,4})?\\)?)`, "i"),
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

function componentRows(text: string, label: RegExp) {
  return text.split("\n").map((value) => value.trim()).flatMap((line, rowIndex) => {
    const match = line.match(label);
    return match?.index == null
      ? []
      : [{ line, value: line.slice(match.index + match[0].length).trim(), rowIndex }];
  });
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

function itemizedPreTaxTotal(text: string, hasYtdColumn: boolean) {
  const labels = [
    /\b401\s*\(k\)\s+pre(?:\s*tax)?\b/i,
    /\bdental\s+pre[ -]?tax\b/i,
    /\bhsa\s+contrib(?:ution)?\b/i,
    /\bmedical\s+pre[ -]?tax\b/i,
    /\bvision\s+pre[ -]?tax\b/i,
    /\bfsa\s+contrib(?:ution)?\b/i,
  ];
  const rows = labels
    .map((label) => likelyCurrentAmount(componentLine(text, label), hasYtdColumn))
    .filter(Boolean);
  return rows.length > 0 ? sumDecimalValues(rows) : "";
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

function extractionIssue(
  code: PayrollExtractionIssueCode,
  severity: PayrollExtractionIssueSeverity,
  message: string,
  observationSequence?: number,
): PayrollExtractionIssue {
  return { code, severity, message, ...(observationSequence ? { observationSequence } : {}) };
}

function datesInLine(line: string) {
  const matches = [...line.matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g)];
  return {
    tokenCount: matches.length,
    values: matches.map((match) => isoDate(match[1], match[2], match[3])).filter(Boolean),
  };
}

function likelyHoursAt(value?: string) {
  if (!value) return "";
  const number = Number(value);
  return number >= 0 && number <= 168 ? value : "";
}

function likelyPositiveRate(value?: string) {
  if (!value) return "";
  const number = Number(value);
  return number > 0 && number < 500 ? value : "";
}

function regularObservation(
  row: ReturnType<typeof componentRows>[number],
  sequence: number,
  input: { hasYtdColumn: boolean; periodStart: string; periodEnd: string },
): RegularRateObservation {
  const values = lineNumbers(row.value);
  const expectedColumns = input.hasYtdColumn ? 4 : 3;
  const issues: PayrollExtractionIssue[] = [];
  let regularHours = "";
  let hourlyRate = "";
  let regularEarnings = "";

  if (values.length > expectedColumns) {
    issues.push(extractionIssue(
      "AMBIGUOUS_REGULAR_COLUMNS",
      "UNSUPPORTED",
      "This regular-pay row contains extra numeric columns that do not match the supported Workday Hours, Rate, Current, and optional YTD structure.",
      sequence,
    ));
  } else {
    regularHours = likelyHoursAt(values[0]);
    if (input.hasYtdColumn && values.length === 3) {
      hourlyRate = likelyPositiveRate(values[1]);
      issues.push(extractionIssue(
        "CURRENT_YTD_AMBIGUOUS",
        "REVIEW_REQUIRED",
        "The regular-pay row does not contain enough values to distinguish current earnings from YTD earnings.",
        sequence,
      ));
    } else if (values.length >= expectedColumns) {
      hourlyRate = likelyPositiveRate(values[1]);
      regularEarnings = values[2] ?? "";
    } else if (!input.hasYtdColumn && values.length === 2) {
      if (likelyPositiveRate(values[1])) hourlyRate = values[1];
      else regularEarnings = values[1];
      issues.push(extractionIssue(
        "AMBIGUOUS_REGULAR_COLUMNS",
        "REVIEW_REQUIRED",
        "The regular-pay row is missing a numeric column, so the remaining value cannot prove both rate and current earnings.",
        sequence,
      ));
    }
  }

  if (!regularHours) {
    issues.push(extractionIssue(
      "MISSING_REGULAR_HOURS",
      "REVIEW_REQUIRED",
      "Regular hours were not reliably identified in this row.",
      sequence,
    ));
  } else if (Number(regularHours) === 0) {
    issues.push(extractionIssue(
      "ZERO_HOUR_REGULAR_ROW",
      "REVIEW_REQUIRED",
      "A zero-hour regular row cannot establish authoritative hourly-rate evidence.",
      sequence,
    ));
  } else if (decimalHoursToMinutes(regularHours) === undefined) {
    issues.push(extractionIssue(
      "REGULAR_HOURS_NOT_WHOLE_MINUTES",
      "REVIEW_REQUIRED",
      "Regular hours do not resolve to whole minutes and cannot be persisted without review.",
      sequence,
    ));
  }
  if (!hourlyRate) {
    issues.push(extractionIssue(
      "MISSING_REGULAR_RATE",
      "REVIEW_REQUIRED",
      "A reliable positive hourly rate was not identified in this regular-pay row.",
      sequence,
    ));
  }
  if (!regularEarnings) {
    issues.push(extractionIssue(
      "MISSING_REGULAR_EARNINGS",
      "REVIEW_REQUIRED",
      "Current-period regular earnings were not reliably identified in this row.",
      sequence,
    ));
  }

  const rowDateResult = datesInLine(row.line);
  const rowDates = rowDateResult.values;
  const rowDateStart = rowDates[0];
  const rowDateEnd = rowDates[1];
  if (rowDateResult.tokenCount !== rowDates.length) {
    issues.push(extractionIssue(
      "ROW_DATE_RANGE_INVALID",
      "UNSUPPORTED",
      "The regular-pay row contains an invalid calendar date.",
      sequence,
    ));
  } else if (rowDates.length === 1 || rowDates.length > 2) {
    issues.push(extractionIssue(
      "ROW_DATE_RANGE_INVALID",
      "REVIEW_REQUIRED",
      "The regular-pay row does not contain one reliable start/end date range.",
      sequence,
    ));
  } else if (rowDateStart && rowDateEnd && rowDateEnd < rowDateStart) {
    issues.push(extractionIssue(
      "ROW_DATE_RANGE_INVALID",
      "UNSUPPORTED",
      "The regular-pay row date range ends before it starts.",
      sequence,
    ));
  } else if (
    rowDateStart && rowDateEnd && input.periodStart && input.periodEnd &&
    (rowDateStart < input.periodStart || rowDateEnd > input.periodEnd)
  ) {
    issues.push(extractionIssue(
      "ROW_DATE_OUTSIDE_PAY_PERIOD",
      "REVIEW_REQUIRED",
      "The regular-pay row date range falls outside the extracted pay period.",
      sequence,
    ));
  }

  if (regularHours && hourlyRate && regularEarnings) {
    const consistency = assessRegularRateConsistency(regularHours, hourlyRate, regularEarnings);
    if (!consistency?.consistent) {
      issues.push(extractionIssue(
        "RATE_EARNINGS_MISMATCH",
        "REVIEW_REQUIRED",
        consistency
          ? `Regular hours multiplied by the hourly rate produce ${consistency.expectedEarnings}, which does not match this row's regular earnings within one cent.`
          : "Regular hours, rate, and earnings could not be compared exactly.",
        sequence,
      ));
    }
  }

  const hasBlockingIssue = issues.some((item) => item.severity !== "INFO");
  return {
    sequence,
    rowIndex: row.rowIndex,
    hourlyRate,
    regularHours,
    ...(regularHours && decimalHoursToMinutes(regularHours) !== undefined
      ? { regularMinutes: decimalHoursToMinutes(regularHours) }
      : {}),
    regularEarnings,
    ...(rowDateStart ? { rowDateStart } : {}),
    ...(rowDateEnd ? { rowDateEnd } : {}),
    payPeriodStart: input.periodStart,
    payPeriodEnd: input.periodEnd,
    extractionBasis: "EXPLICIT_WORKDAY_REGULAR_ROW",
    dateConfidence: rowDateStart && rowDateEnd
      ? "EXPLICIT_ROW_RANGE"
      : input.periodStart && input.periodEnd
        ? "PAY_PERIOD_ONLY"
        : "UNKNOWN",
    issues,
    eligibleForVerification: !hasBlockingIssue &&
      Number(regularHours) > 0 &&
      positiveDecimal(hourlyRate) &&
      Boolean(regularEarnings),
  };
}

function buildRateExtraction(
  text: string,
  input: { periodStart: string; periodEnd: string; hasYtdColumn: boolean },
): RateExtractionResult {
  const rows = componentRows(text, /\bREGULAR\b/i);
  const observations = rows.map((row, index) => regularObservation(row, index + 1, input));
  const issues = observations.flatMap((observation) => observation.issues);

  if (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) {
    issues.push(extractionIssue(
      "PAY_PERIOD_RANGE_INVALID",
      "UNSUPPORTED",
      "The extracted pay period ends before it starts.",
    ));
  }
  if (observations.length === 0) {
    issues.push(/\badjust(?:ment|ed|ing)?\b/i.test(text)
      ? extractionIssue(
          "ADJUSTMENT_ONLY_DOCUMENT",
          "UNSUPPORTED",
          "This appears to be an adjustment-only document and cannot establish a regular hourly rate.",
        )
      : extractionIssue(
          "NO_REGULAR_RATE_OBSERVATIONS",
          "UNSUPPORTED",
          "No supported Workday regular-pay row was found.",
        ));
  }
  if (observations.length > 1) {
    issues.push(extractionIssue(
      "MULTIPLE_REGULAR_ROWS",
      "INFO",
      `${observations.length} regular-pay rows were preserved in source order.`,
    ));
  }

  const rateKeys = new Set(observations.map((item) => normalizedDecimalKey(item.hourlyRate)).filter(Boolean));
  if (rateKeys.size > 1) {
    issues.push(extractionIssue(
      "MULTIPLE_REGULAR_RATES",
      "REVIEW_REQUIRED",
      "Different regular hourly rates were found in this payslip. No single authoritative rate will be submitted.",
    ));
    if (observations.some((item) => item.dateConfidence !== "EXPLICIT_ROW_RANGE")) {
      issues.push(extractionIssue(
        "MULTIPLE_REGULAR_RATES_WITHOUT_EXPLICIT_DATES",
        "UNSUPPORTED",
        "Different regular rates do not all have reliable row date ranges, so their effective boundary cannot be represented safely.",
      ));
    }
  }

  const disposition = issues.some((item) => item.severity === "UNSUPPORTED")
    ? "UNSUPPORTED" as const
    : issues.some((item) => item.severity === "REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED" as const
      : "SUPPORTED" as const;
  return { disposition, observations, issues };
}

export function parseWorkdayPaycheckText(
  sourceText: string,
  fingerprint = "manual-review",
  layout: WorkdayLayout = {},
): ParsedPaycheck {
  const text = normalizeText(sourceText);
  const tables = layout.tables ?? [];
  const hasYtdColumn = /\bYTD\b/i.test(text);
  const overtimeBaseLine = componentLine(text, /overtime\s*1(?:\.0)?x/i);
  const overtimePremiumLine = componentLine(text, /overtime\s*(?:premium\s*)?(?:-|–)?\s*0?\.5x/i);
  const overtimeBaseHours = firstLikelyHours(overtimeBaseLine);
  const overtimePremiumHours = firstLikelyHours(overtimePremiumLine);
  const overtimeHours = overtimeBaseHours || overtimePremiumHours;
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
    amountAfter(text, ["Total Pre Tax Deductions", "Total Pre-Tax Deductions"]) ||
    itemizedPreTaxTotal(text, hasYtdColumn);
  const postTaxDeductions =
    tableValueBelow(tables, [/^post[ -]?tax deductions?$/i], amountIn) ||
    amountAfter(text, ["Post Tax Deductions", "Post-Tax Deductions"]);
  const rateExtraction = buildRateExtraction(text, { periodStart, periodEnd, hasYtdColumn });
  const regularHours = sumDecimalValues(
    rateExtraction.observations.map((observation) => observation.regularHours).filter(Boolean),
  );
  const regularEarnings = sumDecimalValues(
    rateExtraction.observations.map((observation) => observation.regularEarnings).filter(Boolean),
  );
  const reliableRates = rateExtraction.observations
    .map((observation) => observation.hourlyRate)
    .filter(Boolean);
  const distinctRates = new Set(reliableRates.map(normalizedDecimalKey));
  const baseRate = rateExtraction.disposition === "SUPPORTED" && distinctRates.size === 1
    ? reliableRates[0]
    : "";

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
  const warnedIssueCodes = new Set<PayrollExtractionIssueCode>();
  for (const issue of rateExtraction.issues) {
    if (issue.severity !== "INFO" && !warnedIssueCodes.has(issue.code)) {
      warnings.push(issue.message);
      warnedIssueCodes.add(issue.code);
    }
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
    importMode: "PDF_IMPORT",
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
    rateExtraction,
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
  let parser: PDFParseInstance | undefined;
  try {
    // PDF.js initializes native Node helpers when pdf-parse is loaded. Keep that
    // work out of ordinary Payroll rendering and load it only for extraction.
    await import("@napi-rs/canvas");
    const { PDFParse } = await import("pdf-parse");
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
