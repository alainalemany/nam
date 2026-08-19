import { describe, expect, it } from "vitest";

import {
  draglineDelayReportSubmissionSchema,
  normalizeDraglineDelayReportSubmission,
} from "@/features/dragline-delay-reports/validation";

const validInput = {
  operationalWorkDate: "2026-08-18",
  shift: "DAY",
  equipmentId: "equipment-1",
  startingHourMeter: "12345",
  endingHourMeter: "",
  supervisorId: "supervisor-1",
  operators: [{ sequence: 1, employeeId: "operator-1" }],
  timelineEntries: [
    {
      sequence: 1,
      startTime: "08:30",
      dayOffset: 0,
      catalogVersion: 1,
      delayCode: "26",
      description: "Survey crew in radius",
      durationMinutes: "20",
      causesDowntime: true,
    },
  ],
};

describe("Dragline Delay Report validation", () => {
  it("accepts a valid Draft with whole-number meters", () => {
    const result = draglineDelayReportSubmissionSchema.parse(validInput);
    expect(result.startingHourMeter).toBe(12345);
    expect(result.endingHourMeter).toBeUndefined();
  });

  it.each(["SWING", "OTHER", "UNKNOWN"])("rejects global shift value %s", (shift) => {
    expect(
      draglineDelayReportSubmissionSchema.safeParse({ ...validInput, shift }).success,
    ).toBe(false);
  });

  it("enforces the confirmed 5-to-5 boundaries at the submission boundary", () => {
    const submission = ({
      shift,
      startTime,
      dayOffset = 0,
      durationMinutes = "",
    }: {
      shift: "DAY" | "NIGHT";
      startTime: string;
      dayOffset?: 0 | 1;
      durationMinutes?: string;
    }) =>
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        shift,
        timelineEntries: [
          {
            ...validInput.timelineEntries[0],
            startTime,
            dayOffset,
            durationMinutes,
            causesDowntime: durationMinutes !== "",
          },
        ],
      }).success;

    expect(submission({ shift: "DAY", startTime: "05:00" })).toBe(true);
    expect(submission({ shift: "DAY", startTime: "16:59" })).toBe(true);
    expect(submission({ shift: "DAY", startTime: "17:00" })).toBe(false);
    expect(submission({ shift: "DAY", startTime: "04:59" })).toBe(false);
    expect(
      submission({ shift: "DAY", startTime: "16:30", durationMinutes: "30" }),
    ).toBe(true);
    expect(
      submission({ shift: "DAY", startTime: "16:31", durationMinutes: "30" }),
    ).toBe(false);

    expect(submission({ shift: "NIGHT", startTime: "17:00" })).toBe(true);
    expect(submission({ shift: "NIGHT", startTime: "23:30" })).toBe(true);
    expect(
      submission({ shift: "NIGHT", startTime: "00:20", dayOffset: 1 }),
    ).toBe(true);
    expect(
      submission({ shift: "NIGHT", startTime: "04:59", dayOffset: 1 }),
    ).toBe(true);
    expect(
      submission({ shift: "NIGHT", startTime: "05:00", dayOffset: 1 }),
    ).toBe(false);
    expect(
      submission({
        shift: "NIGHT",
        startTime: "04:30",
        dayOffset: 1,
        durationMinutes: "30",
      }),
    ).toBe(true);
    expect(
      submission({
        shift: "NIGHT",
        startTime: "04:31",
        dayOffset: 1,
        durationMinutes: "30",
      }),
    ).toBe(false);
  });

  it.each(["12.5", "-1", "abc"])("rejects non-whole starting meter %s", (meter) => {
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        startingHourMeter: meter,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown codes and downtime without duration", () => {
    const unknown = structuredClone(validInput);
    unknown.timelineEntries[0].delayCode = "3";
    expect(draglineDelayReportSubmissionSchema.safeParse(unknown).success).toBe(false);

    const incomplete = structuredClone(validInput);
    incomplete.timelineEntries[0].durationMinutes = "";
    expect(draglineDelayReportSubmissionSchema.safeParse(incomplete).success).toBe(false);
  });

  it("allows same-time concurrent activities and excludes non-downtime work", () => {
    const result = draglineDelayReportSubmissionSchema.safeParse({
      ...validInput,
      timelineEntries: [
        validInput.timelineEntries[0],
        {
          ...validInput.timelineEntries[0],
          sequence: 2,
          delayCode: "34",
          description: "cleaning Motor 2 room",
          causesDowntime: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("allows a Draft with no saved timeline rows but requires an Operator", () => {
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        timelineEntries: [],
      }).success,
    ).toBe(true);
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        operators: [],
      }).success,
    ).toBe(false);
  });

  it("validates optional whole-number production measurements", () => {
    const parsed = draglineDelayReportSubmissionSchema.parse({
      ...validInput,
      normalDiggingBuckets: "120",
      benchfillBuckets: "15",
      depthFeet: "65",
      fuelGallons: "500",
      cableDragFeet: "12",
      hoistFeet: "8",
    });
    expect(parsed).toMatchObject({
      normalDiggingBuckets: 120,
      benchfillBuckets: 15,
      depthFeet: 65,
      fuelGallons: 500,
      cableDragFeet: 12,
      hoistFeet: 8,
    });

    for (const field of [
      "normalDiggingBuckets",
      "benchfillBuckets",
      "depthFeet",
      "fuelGallons",
      "cableDragFeet",
      "hoistFeet",
    ]) {
      expect(
        draglineDelayReportSubmissionSchema.safeParse({
          ...validInput,
          [field]: "-1",
        }).success,
      ).toBe(false);
    }
  });

  it("requires a valid station pair and normalizes both directions", () => {
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        stationStart: "50+30",
        stationEnd: "",
      }).success,
    ).toBe(false);
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        stationStart: "50+30",
        stationEnd: "50+100",
      }).success,
    ).toBe(false);

    const parsed = draglineDelayReportSubmissionSchema.parse({
      ...validInput,
      stationStart: "50+60",
      stationEnd: "50+30",
    });
    expect(normalizeDraglineDelayReportSubmission(parsed)).toMatchObject({
      stationStartFeet: 5060,
      stationEndFeet: 5030,
    });
  });

  it("normalizes ordered Ground Check times and enforces the report shift window", () => {
    const parsed = draglineDelayReportSubmissionSchema.parse({
      ...validInput,
      shift: "NIGHT",
      timelineEntries: [],
      groundChecks: [
        { sequence: 1, startTime: "23:30", dayOffset: 0 },
        { sequence: 2, startTime: "00:20", dayOffset: 1 },
        { sequence: 3, startTime: "04:59", dayOffset: 1 },
      ],
    });
    expect(
      normalizeDraglineDelayReportSubmission(parsed).groundChecks.map(
        (groundCheck) => groundCheck.startMinuteOffset,
      ),
    ).toEqual([1410, 1460, 1739]);
    expect(
      draglineDelayReportSubmissionSchema.safeParse({
        ...validInput,
        shift: "NIGHT",
        groundChecks: [
          { sequence: 1, startTime: "05:00", dayOffset: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});
