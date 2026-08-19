import { describe, expect, it } from "vitest";

import { draglineDelayReportSubmissionSchema } from "@/features/dragline-delay-reports/validation";

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
});
