"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseZonedDateTime } from "@/lib/zoned-date-time";

import {
  addManualMaintenanceAdjustment,
  createMaintenanceTracker,
  recordMaintenanceService,
  saveMaintenanceComponent,
  saveMaintenanceRule,
} from "./persistence";
import {
  maintenanceComponentSchema,
  maintenanceFormObject,
  maintenanceAdjustmentSchema,
  maintenanceRuleSchema,
  maintenanceServiceSchema,
  maintenanceTrackerSchema,
  maintenanceValidationState,
  type MaintenanceActionState,
} from "./validation";

function actionError(message: string): MaintenanceActionState {
  return { status: "error", message, fieldErrors: {} };
}

function persistenceError(error: unknown, duplicateMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return actionError(duplicateMessage);
  }
  return actionError(error instanceof Error ? error.message : "Maintenance data could not be saved.");
}

export async function saveMaintenanceComponentAction(
  id: string | null,
  _previous: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const parsed = maintenanceComponentSchema.safeParse(maintenanceFormObject(formData));
  if (!parsed.success) return maintenanceValidationState(parsed.error);

  let component;
  try {
    component = await saveMaintenanceComponent(id, parsed.data);
  } catch (error) {
    return persistenceError(error, "A tracked component with this name already exists.");
  }
  revalidatePath("/reference-data");
  revalidatePath("/reference-data/maintenance-components");
  redirect(`/reference-data/maintenance-components/${component.id}/edit?saved=component`);
}

export async function saveMaintenanceRuleAction(
  componentId: string,
  id: string | null,
  _previous: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const parsed = maintenanceRuleSchema.safeParse(maintenanceFormObject(formData));
  if (!parsed.success) return maintenanceValidationState(parsed.error);

  try {
    await saveMaintenanceRule(componentId, id, parsed.data);
  } catch (error) {
    return persistenceError(error, "This component already has a rule in that order position.");
  }
  revalidatePath(`/reference-data/maintenance-components/${componentId}/edit`);
  revalidatePath("/reference-data/maintenance-components");
  redirect(`/reference-data/maintenance-components/${componentId}/edit?saved=rule`);
}

export async function createMaintenanceTrackerAction(
  _previous: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const parsed = maintenanceTrackerSchema.safeParse(maintenanceFormObject(formData));
  if (!parsed.success) return maintenanceValidationState(parsed.error);

  let tracker;
  try {
    tracker = await createMaintenanceTracker({
      ...parsed.data,
      trackingStartedAt: parseZonedDateTime(parsed.data.trackingStartDate, parsed.data.trackingStartTime),
    });
  } catch (error) {
    return persistenceError(error, "This Equipment already tracks that component.");
  }
  revalidatePath("/");
  revalidatePath("/maintenance");
  redirect(`/maintenance/${tracker.id}`);
}

export async function addManualMaintenanceAdjustmentAction(
  trackerId: string,
  _previous: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const parsed = maintenanceAdjustmentSchema.safeParse(maintenanceFormObject(formData));
  if (!parsed.success) return maintenanceValidationState(parsed.error);

  try {
    await addManualMaintenanceAdjustment(trackerId, {
      ...parsed.data,
      effectiveAt: parseZonedDateTime(parsed.data.effectiveDate, parsed.data.effectiveTime),
    });
  } catch (error) {
    return persistenceError(error, "Hours could not be added.");
  }
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${trackerId}`);
  redirect(`/maintenance/${trackerId}?saved=adjustment`);
}

export async function recordMaintenanceServiceAction(
  trackerId: string,
  _previous: MaintenanceActionState,
  formData: FormData,
): Promise<MaintenanceActionState> {
  const parsed = maintenanceServiceSchema.safeParse(maintenanceFormObject(formData));
  if (!parsed.success) return maintenanceValidationState(parsed.error);

  try {
    await recordMaintenanceService(trackerId, {
      ...parsed.data,
      effectiveAt: parseZonedDateTime(parsed.data.effectiveDate, parsed.data.effectiveTime),
    });
  } catch (error) {
    return persistenceError(error, "Service could not be recorded.");
  }
  revalidatePath("/");
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${trackerId}`);
  redirect(`/maintenance/${trackerId}?saved=service`);
}
