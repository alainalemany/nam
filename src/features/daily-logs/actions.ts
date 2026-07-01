"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  dailyLogActivitySchema,
  dailyLogFormSchema,
  emptyDailyLogFormState,
  type DailyLogFormInput,
  type DailyLogFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

function toDateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function errorState(message: string): DailyLogFormState {
  return {
    ...emptyDailyLogFormState,
    status: "error",
    message,
  };
}

function getAll(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

function parseActivities(formData: FormData) {
  const activityTypes = getAll(formData, "activityType");
  const titles = getAll(formData, "activityTitle");
  const startTimes = getAll(formData, "activityStartTime");
  const endTimes = getAll(formData, "activityEndTime");
  const descriptions = getAll(formData, "activityDescription");
  const equipmentIds = getAll(formData, "activityEquipmentId");
  const locations = getAll(formData, "activityLocation");
  const contractorCompanies = getAll(formData, "activityContractorCompany");
  const personNames = getAll(formData, "activityPersonName");
  const notes = getAll(formData, "activityNotes");

  return activityTypes
    .map((activityType, index) => ({
      activityType,
      title: titles[index] ?? "",
      startTime: startTimes[index] ?? "",
      endTime: endTimes[index] ?? "",
      description: descriptions[index] ?? "",
      equipmentId: equipmentIds[index] ?? "",
      location: locations[index] ?? "",
      contractorCompany: contractorCompanies[index] ?? "",
      personName: personNames[index] ?? "",
      notes: notes[index] ?? "",
    }))
    .filter((activity) =>
      [
        activity.title,
        activity.startTime,
        activity.endTime,
        activity.description,
        activity.equipmentId,
        activity.location,
        activity.contractorCompany,
        activity.personName,
        activity.notes,
      ].some((value) => value.trim().length > 0),
    )
    .map((activity) => dailyLogActivitySchema.parse(activity));
}

function parseFormData(formData: FormData):
  | { ok: true; data: DailyLogFormInput }
  | { ok: false; state: DailyLogFormState } {
  try {
    const parsed = dailyLogFormSchema.safeParse({
      logDate: formData.get("logDate"),
      shift: formData.get("shift"),
      mineId: formData.get("mineId"),
      primaryEquipmentId: formData.get("primaryEquipmentId"),
      summary: formData.get("summary"),
      weatherConditions: formData.get("weatherConditions"),
      generalNotes: formData.get("generalNotes"),
      activities: parseActivities(formData),
    });

    if (!parsed.success) {
      return {
        ok: false,
        state: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      };
    }

    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the activity rows and try again.",
        fieldErrors: {
          activities: ["Each saved activity needs a title."],
        },
      },
    };
  }
}

function activityCreateData(input: DailyLogFormInput) {
  const activityDate = toDateOnly(input.logDate);

  return input.activities.map((activity, index) => ({
    activityDate,
    sequence: index + 1,
    activityType: activity.activityType,
    title: activity.title,
    startTime: asNullable(activity.startTime),
    endTime: asNullable(activity.endTime),
    description: asNullable(activity.description),
    equipmentId: asNullable(activity.equipmentId),
    location: asNullable(activity.location),
    contractorCompany: asNullable(activity.contractorCompany),
    personName: asNullable(activity.personName),
    notes: asNullable(activity.notes),
  }));
}

export async function createDailyLogAction(
  _previousState: DailyLogFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  let dailyLogId: string;

  try {
    const dailyLog = await prisma.dailyLog.create({
      data: {
        logDate: toDateOnly(input.data.logDate),
        shift: input.data.shift,
        mineId: asNullable(input.data.mineId),
        primaryEquipmentId: asNullable(input.data.primaryEquipmentId),
        summary: input.data.summary,
        weatherConditions: asNullable(input.data.weatherConditions),
        generalNotes: asNullable(input.data.generalNotes),
        activities: {
          create: activityCreateData(input.data),
        },
      },
    });

    dailyLogId = dailyLog.id;
  } catch {
    return errorState("Daily Log could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/daily-logs");
  redirect(`/daily-logs/${dailyLogId}`);
}

export async function updateDailyLogAction(
  dailyLogId: string,
  _previousState: DailyLogFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dailyLogActivity.deleteMany({
        where: {
          dailyLogId,
        },
      });

      await tx.dailyLog.update({
        where: { id: dailyLogId },
        data: {
          logDate: toDateOnly(input.data.logDate),
          shift: input.data.shift,
          mineId: asNullable(input.data.mineId),
          primaryEquipmentId: asNullable(input.data.primaryEquipmentId),
          summary: input.data.summary,
          weatherConditions: asNullable(input.data.weatherConditions),
          generalNotes: asNullable(input.data.generalNotes),
          activities: {
            create: activityCreateData(input.data),
          },
        },
      });
    });
  } catch {
    return errorState("Daily Log could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/daily-logs");
  revalidatePath(`/daily-logs/${dailyLogId}`);
  redirect(`/daily-logs/${dailyLogId}`);
}
