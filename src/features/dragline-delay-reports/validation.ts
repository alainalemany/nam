import { z } from "zod";

import {
  DRAGLINE_DELAY_CODE_CATALOG_VERSION,
  getDraglineDelayCode,
} from "./catalog";
import { calculateDraglineShiftTotals } from "./calculations";
import { hasFinalShiftChangeEntry } from "./lifecycle";
import { parseStationNotation } from "./station";
import {
  normalizeEventStartTime,
  validateScheduledShiftStart,
} from "./time";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

const requiredId = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(200);

const optionalId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || undefined);

const wholeNumberInput = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value.trim());
      }
      return Number.NaN;
    },
    z
      .number({ message: `${label} must be a whole number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(POSTGRES_INTEGER_MAX, `${label} is too large.`),
  );

const optionalWholeNumberInput = (label: string) =>
  z.preprocess(
    (value) => {
      if (value === "" || value == null) return undefined;
      if (typeof value === "number") return value;
      if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value.trim());
      }
      return Number.NaN;
    },
    z
      .number({ message: `${label} must be a whole number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(POSTGRES_INTEGER_MAX, `${label} is too large.`)
      .optional(),
  );

const positiveWholeNumberInput = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "number") return value;
      if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value.trim());
      }
      return Number.NaN;
    },
    z
      .number({ message: `${label} must be a positive whole number.` })
      .int(`${label} must be a positive whole number.`)
      .positive(`${label} must be greater than zero.`)
      .max(POSTGRES_INTEGER_MAX, `${label} is too large.`),
  );

const optionalPositiveWholeNumberInput = (label: string) =>
  z.preprocess(
    (value) => {
      if (value === "" || value == null) return undefined;
      if (typeof value === "number") return value;
      if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value.trim());
      }
      return Number.NaN;
    },
    z
      .number({ message: `${label} must be a positive whole number.` })
      .int(`${label} must be a positive whole number.`)
      .positive(`${label} must be greater than zero.`)
      .max(POSTGRES_INTEGER_MAX, `${label} is too large.`)
      .optional(),
  );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => value || undefined);

const optionalStationInput = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

function isDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const draglineDelayReportOperatorSchema = z.object({
  id: optionalId,
  sequence: positiveWholeNumberInput("Operator sequence"),
  employeeId: requiredId("Operator"),
});

export const draglineDelayReportTimelineEntrySchema = z.object({
  id: optionalId,
  sequence: positiveWholeNumberInput("Timeline sequence"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid event start time."),
  dayOffset: z.union([z.literal(0), z.literal(1)]),
  catalogVersion: z.literal(DRAGLINE_DELAY_CODE_CATALOG_VERSION),
  delayCode: z.string().trim().min(1, "Delay Code is required."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional()
    .transform((value) => value || undefined),
  durationMinutes: optionalPositiveWholeNumberInput("Duration"),
  causesDowntime: z.boolean(),
});

export const draglineDelayReportGroundCheckSchema = z.object({
  id: optionalId,
  sequence: positiveWholeNumberInput("Ground Check sequence"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid Ground Check time."),
  dayOffset: z.union([z.literal(0), z.literal(1)]),
});

export const draglineDelayReportSubmissionSchema = z
  .object({
    operationalWorkDate: z
      .string()
      .trim()
      .refine(isDateOnly, "Enter a valid operational work date."),
    shift: z.enum(["DAY", "NIGHT"], {
      message: "Dragline Delay Reports use Day or Night shift only.",
    }),
    equipmentId: requiredId("Dragline Equipment"),
    startingHourMeter: wholeNumberInput("Starting Hour Meter"),
    endingHourMeter: optionalWholeNumberInput("Ending Hour Meter"),
    supervisorId: optionalId,
    lakeId: optionalId,
    normalDiggingBuckets: optionalWholeNumberInput("Normal Digging Buckets"),
    benchfillBuckets: optionalWholeNumberInput("Benchfill Buckets"),
    stationStart: optionalStationInput,
    stationEnd: optionalStationInput,
    depthFeet: optionalWholeNumberInput("Depth"),
    fuelGallons: optionalWholeNumberInput("Fuel"),
    cableDragFeet: optionalWholeNumberInput("Cable Drag"),
    hoistFeet: optionalWholeNumberInput("Hoist"),
    comments: optionalText("Comments", 5000),
    safetyItemsFound: optionalText("Safety Items Found", 5000),
    actionTaken: optionalText("Action Taken", 5000),
    recordVersion: optionalPositiveWholeNumberInput("Record version"),
    operators: z
      .array(draglineDelayReportOperatorSchema)
      .min(1, "Add at least one Operator.")
      .max(20, "A report may contain at most 20 Operators."),
    timelineEntries: z
      .array(draglineDelayReportTimelineEntrySchema)
      .max(200, "A report may contain at most 200 timeline entries."),
    groundChecks: z
      .array(draglineDelayReportGroundCheckSchema)
      .max(100, "A report may contain at most 100 Ground Checks.")
      .default([]),
  })
  .superRefine((value, context) => {
    if (Boolean(value.stationStart) !== Boolean(value.stationEnd)) {
      const missingField = value.stationStart ? "stationEnd" : "stationStart";
      context.addIssue({
        code: "custom",
        path: [missingField],
        message: "Enter both Station Start and Station End, or leave both blank.",
      });
    }
    for (const [field, station] of [
      ["stationStart", value.stationStart],
      ["stationEnd", value.stationEnd],
    ] as const) {
      if (!station) continue;
      try {
        const parsedStation = parseStationNotation(station);
        if (parsedStation.absoluteFeet > POSTGRES_INTEGER_MAX) {
          throw new Error("Station is outside the supported range.");
        }
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: error instanceof Error ? error.message : "Station is invalid.",
        });
      }
    }

    const operatorIds = new Set<string>();
    const operatorRowIds = new Set<string>();
    value.operators.forEach((operator, index) => {
      if (operator.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["operators", index, "sequence"],
          message: "Operator order must be contiguous and start at 1.",
        });
      }
      if (operatorIds.has(operator.employeeId)) {
        context.addIssue({
          code: "custom",
          path: ["operators", index, "employeeId"],
          message: "An Employee may appear only once as an Operator.",
        });
      }
      operatorIds.add(operator.employeeId);
      if (operator.id) {
        if (operatorRowIds.has(operator.id)) {
          context.addIssue({
            code: "custom",
            path: ["operators", index, "id"],
            message: "Operator row identity is duplicated.",
          });
        }
        operatorRowIds.add(operator.id);
      }
    });

    const timelineIds = new Set<string>();
    const calculationEntries: Array<{
      startMinuteOffset: number;
      durationMinutes?: number;
      causesDowntime: boolean;
    }> = [];

    value.timelineEntries.forEach((entry, index) => {
      if (entry.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["timelineEntries", index, "sequence"],
          message: "Timeline order must be contiguous and start at 1.",
        });
      }
      if (entry.id) {
        if (timelineIds.has(entry.id)) {
          context.addIssue({
            code: "custom",
            path: ["timelineEntries", index, "id"],
            message: "Timeline row identity is duplicated.",
          });
        }
        timelineIds.add(entry.id);
      }
      if (!getDraglineDelayCode(entry.delayCode)) {
        context.addIssue({
          code: "custom",
          path: ["timelineEntries", index, "delayCode"],
          message: "Select an official Delay Code from Catalog V1.",
        });
      }
      if (entry.causesDowntime && entry.durationMinutes == null) {
        context.addIssue({
          code: "custom",
          path: ["timelineEntries", index, "durationMinutes"],
          message: "A downtime-causing entry requires a positive duration.",
        });
      }

      try {
        calculationEntries.push({
          startMinuteOffset: normalizeEventStartTime(entry.startTime, entry.dayOffset),
          durationMinutes: entry.durationMinutes,
          causesDowntime: entry.causesDowntime,
        });
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: ["timelineEntries", index, "startTime"],
          message: error instanceof Error ? error.message : "Event time is invalid.",
        });
      }
    });

    try {
      calculateDraglineShiftTotals(value.shift, calculationEntries);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["timelineEntries"],
        message: error instanceof Error ? error.message : "Timeline is invalid.",
      });
    }

    const groundCheckIds = new Set<string>();
    value.groundChecks.forEach((groundCheck, index) => {
      if (groundCheck.sequence !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["groundChecks", index, "sequence"],
          message: "Ground Check order must be contiguous and start at 1.",
        });
      }
      if (groundCheck.id) {
        if (groundCheckIds.has(groundCheck.id)) {
          context.addIssue({
            code: "custom",
            path: ["groundChecks", index, "id"],
            message: "Ground Check row identity is duplicated.",
          });
        }
        groundCheckIds.add(groundCheck.id);
      }
      try {
        validateScheduledShiftStart(
          value.shift,
          normalizeEventStartTime(groundCheck.startTime, groundCheck.dayOffset),
        );
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: ["groundChecks", index, "startTime"],
          message:
            error instanceof Error
              ? error.message.replace("Event", "Ground Check")
              : "Ground Check time is invalid.",
        });
      }
    });
  });

export const draglineDelayReportCompletionSchema =
  draglineDelayReportSubmissionSchema.superRefine((value, context) => {
    if (value.endingHourMeter == null) {
      context.addIssue({
        code: "custom",
        path: ["endingHourMeter"],
        message: "Ending Hour Meter is required to complete the report.",
      });
    }
    if (!value.supervisorId) {
      context.addIssue({
        code: "custom",
        path: ["supervisorId"],
        message: "Supervisor is required to complete the report.",
      });
    }

    const chronology = value.timelineEntries.flatMap((entry) => {
      try {
        return [{
          startMinuteOffset: normalizeEventStartTime(entry.startTime, entry.dayOffset),
          sequence: entry.sequence,
          delayCode: entry.delayCode,
        }];
      } catch {
        return [];
      }
    });
    if (!hasFinalShiftChangeEntry(chronology)) {
      context.addIssue({
        code: "custom",
        path: ["timelineEntries"],
        message: "Final timeline entry must be 13 — Shift Change.",
      });
    }
  });

const correctionReasonSchema = z
  .string({ message: "Correction Reason is required." })
  .trim()
  .min(1, "Correction Reason is required.")
  .max(1000, "Correction Reason must be 1000 characters or fewer.");

export const draglineDelayReportCorrectionSubmissionSchema = z.intersection(
  draglineDelayReportCompletionSchema,
  z.object({ correctionReason: correctionReasonSchema }),
);

export type DraglineDelayReportSubmissionInput = z.infer<
  typeof draglineDelayReportSubmissionSchema
>;

export type DraglineDelayReportCompletionInput = z.infer<
  typeof draglineDelayReportCompletionSchema
>;

export type DraglineDelayReportCorrectionInput = z.infer<
  typeof draglineDelayReportCorrectionSubmissionSchema
>;

export type DraglineDelayReportActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const emptyDraglineDelayReportActionState: DraglineDelayReportActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function draglineDelayReportFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function normalizeDraglineDelayReportSubmission(
  input: DraglineDelayReportSubmissionInput,
) {
  const stationStartFeet = input.stationStart
    ? parseStationNotation(input.stationStart).absoluteFeet
    : undefined;
  const stationEndFeet = input.stationEnd
    ? parseStationNotation(input.stationEnd).absoluteFeet
    : undefined;

  return {
    ...input,
    stationStartFeet,
    stationEndFeet,
    timelineEntries: input.timelineEntries.map((entry) => ({
      ...entry,
      startMinuteOffset: normalizeEventStartTime(entry.startTime, entry.dayOffset),
    })),
    groundChecks: input.groundChecks.map((groundCheck) => ({
      ...groundCheck,
      startMinuteOffset: normalizeEventStartTime(
        groundCheck.startTime,
        groundCheck.dayOffset,
      ),
    })),
  };
}
