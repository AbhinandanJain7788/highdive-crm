// Verbatim defaults from the HTML's userStatusAlertsState / allocationAssignmentState.
export type UserStatusAlertKey = "breakTime" | "idleTime" | "inactiveUser" | "missedCheckIn";

export const userStatusAlertsSeed: Record<
  UserStatusAlertKey,
  { label: string; enabled: boolean; value: number; unit: "Hours" | "Minutes" }
> = {
  breakTime: { label: "Break Time Alert", enabled: false, value: 1, unit: "Hours" },
  idleTime: { label: "Idle Time Alert", enabled: false, value: 1, unit: "Hours" },
  inactiveUser: { label: "Inactive User Alert", enabled: false, value: 24, unit: "Hours" },
  missedCheckIn: { label: "Missed Check-In Alert", enabled: false, value: 1, unit: "Hours" },
};

export const allocationAssignmentSeed = {
  api: { label: "Notify when an allocation is assigned through APIs", enabled: true },
  rechurn: { label: "Notify when an allocation is assigned through Rechurn", enabled: true },
  bulkUpload: { label: "Notify when an allocation is assigned through Bulk Upload", enabled: true },
};
