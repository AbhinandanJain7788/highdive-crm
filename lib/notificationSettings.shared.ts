export type UserStatusAlertKey = "breakTime" | "idleTime" | "inactiveUser" | "missedCheckIn";
export type AllocationAssignmentKey = "api" | "rechurn" | "bulkUpload";
export type ThresholdUnit = "hours" | "minutes";

export const USER_STATUS_ALERT_KEYS: UserStatusAlertKey[] = [
  "breakTime",
  "idleTime",
  "inactiveUser",
  "missedCheckIn",
];
export const ALLOCATION_ASSIGNMENT_KEYS: AllocationAssignmentKey[] = ["api", "rechurn", "bulkUpload"];

export type UserStatusAlertState = { enabled: boolean; value: number; unit: "Hours" | "Minutes" };

export const USER_STATUS_ALERT_DEFAULTS: Record<UserStatusAlertKey, UserStatusAlertState> = {
  breakTime: { enabled: false, value: 1, unit: "Hours" },
  idleTime: { enabled: false, value: 1, unit: "Hours" },
  inactiveUser: { enabled: false, value: 24, unit: "Hours" },
  missedCheckIn: { enabled: false, value: 1, unit: "Hours" },
};

export const ALLOCATION_ASSIGNMENT_DEFAULTS: Record<AllocationAssignmentKey, boolean> = {
  api: true,
  rechurn: true,
  bulkUpload: true,
};

export type NotificationSettingsPayload = {
  userStatusAlerts: Record<UserStatusAlertKey, UserStatusAlertState>;
  allocationAlerts: Record<AllocationAssignmentKey, boolean>;
};
