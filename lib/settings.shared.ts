export type GeneralSettings = {
  limitAssignTo: boolean;
  whatsappNotifications: boolean;
  logoutMobile: boolean;
  logoutWeb: boolean;
};

export const GENERAL_SETTINGS_DEFAULTS: GeneralSettings = {
  limitAssignTo: false,
  whatsappNotifications: true,
  logoutMobile: true,
  logoutWeb: true,
};

export type CompanyDetails = {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

export const COMPANY_DETAILS_DEFAULTS: CompanyDetails = {
  companyName: "",
  address: "",
  phone: "",
  email: "",
  website: "",
};

export type ActivityLogRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export const PASSWORD_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8 && v.length <= 15, label: "Password must be 8-15 characters long." },
  { test: (v) => /[A-Z]/.test(v), label: "Include an upperCase character" },
  { test: (v) => /[0-9]/.test(v), label: "Include a number" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "Include a special character" },
];
