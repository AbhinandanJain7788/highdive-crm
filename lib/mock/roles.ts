// Matches Phase 0's seeded roles/permissions exactly (2 roles, 18 permissions).
export type MockRole = {
  id: string;
  name: string;
  dotColor: string;
  badgeBg: string;
  permissionsPreview: string;
  moreCount: number;
  users: number;
  createdOn: string;
};

export const rolesSeed: MockRole[] = [
  { id: "r1", name: "Admin", dotColor: "#B33FA0", badgeBg: "#F6E4F5", permissionsPreview: "User Web Panel, Bulk Import, Bulk Export", moreCount: 15, users: 2, createdOn: "02:42 PM, 29 Aug" },
  { id: "r2", name: "User", dotColor: "#5B6472", badgeBg: "#EEF0F5", permissionsPreview: "User Web Panel, Play Call Recordings, Show Pop-up", moreCount: 8, users: 7, createdOn: "02:42 PM, 29 Aug" },
];

export const permissionsSeed = [
  { key: "user_web_panel", label: "User Web Panel", category: "General" },
  { key: "show_pop_up", label: "Show Pop-up", category: "General" },
  { key: "play_call_recordings", label: "Play Call Recordings", category: "Calls" },
  { key: "attribute_calls", label: "Attribute Calls to Jobs", category: "Calls" },
  { key: "manage_candidates", label: "Manage Candidates", category: "Recruitment" },
  { key: "manage_jobs", label: "Manage Jobs", category: "Recruitment" },
  { key: "manage_clients", label: "Manage Clients", category: "Recruitment" },
  { key: "manage_allocations", label: "Manage Allocations", category: "Recruitment" },
  { key: "manage_assignment", label: "Assign & Distribute Candidates", category: "Recruitment" },
  { key: "manage_follow_ups", label: "Manage Follow-Ups", category: "Recruitment" },
  { key: "manage_rechurn", label: "Manage Rechurn", category: "Recruitment" },
  { key: "view_analytics", label: "View Analytics", category: "Reports" },
  { key: "request_reports", label: "Request Reports", category: "Reports" },
  { key: "bulk_import", label: "Bulk Import", category: "Data Management" },
  { key: "bulk_export", label: "Bulk Export", category: "Data Management" },
  { key: "bulk_delete", label: "Bulk Delete", category: "Data Management" },
  { key: "manage_team", label: "Manage Team", category: "Administration" },
  { key: "manage_roles_permissions", label: "Manage Roles & Permissions", category: "Administration" },
];
