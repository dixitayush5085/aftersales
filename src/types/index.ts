export const ROLES = ["ADMIN", "MANAGER", "TEAM_LEAD", "TEAM_MEMBER"] as const;

export type Role = (typeof ROLES)[number];

/** Lowest privilege first. Used to block inviting or promoting to an equal or higher role. */
const ROLE_RANK: Record<Role, number> = {
  TEAM_MEMBER: 1,
  TEAM_LEAD: 2,
  MANAGER: 3,
  ADMIN: 4,
};

export const PLATFORMS = ["amazon", "flipkart", "meesho"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  meesho: "Meesho",
};

export const PLATFORM_STATUSES = ["open", "pending", "done", "na"] as const;
export type PlatformStatus = (typeof PLATFORM_STATUSES)[number];

export const MILESTONE_STATUSES = ["pending", "in_progress", "done", "blocked"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const LIFECYCLE_STATUSES = ["active", "rolled_back"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const GST_STATUSES = ["YES", "NO", "APPLIED", "APPLIED_THROUGH_US"] as const;
export type GstStatus = (typeof GST_STATUSES)[number];

export const GST_LABELS: Record<GstStatus, string> = {
  YES: "GST yes",
  NO: "No GST",
  APPLIED: "Applied",
  APPLIED_THROUGH_US: "Applied via us",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  TEAM_LEAD: "Team Lead",
  TEAM_MEMBER: "Team Member",
};

export const PERMISSIONS = [
  "assignClients",
  "accessTeam",
  "inviteUsers",
  "promoteUsers",
  "setReportsTo",
  "viewRolledBack",
  "manageAccess",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type PermissionSet = Record<Permission, boolean>;

export const PERMISSION_META: Record<
  Permission,
  { label: string; description: string }
> = {
  assignClients: {
    label: "Assign clients",
    description: "See Unassigned and give converted clients to a team member.",
  },
  accessTeam: {
    label: "View team",
    description: "Open the Team page and copy invite / password links.",
  },
  inviteUsers: {
    label: "Invite people",
    description: "Send invites for roles below yours: Manager, Team Lead, or Team Member.",
  },
  promoteUsers: {
    label: "Promote",
    description: "Promote Team Member → Team Lead → Manager. Only Admin can create a Manager.",
  },
  setReportsTo: {
    label: "Link reporting",
    description: "Attach a Team Member to a Team Lead, or a Team Lead to a Manager.",
  },
  viewRolledBack: {
    label: "See rolled back",
    description: "See clients that LMS rolled back from converted.",
  },
  manageAccess: {
    label: "Configure access",
    description: "Turn actions on or off for each role. Admin only.",
  },
};

export function nextRole(role: Role): Role | null {
  if (role === "TEAM_MEMBER") return "TEAM_LEAD";
  if (role === "TEAM_LEAD") return "MANAGER";
  return null;
}

/** Admin may grant any role. Everyone else may grant only roles strictly below their own. */
export function canGrantRole(actor: Role, target: Role) {
  if (actor === "ADMIN") return true;
  return ROLE_RANK[target] < ROLE_RANK[actor];
}

/**
 * Map a stored or session role onto the current catalog.
 * `SUPER_MANAGER` was the old tier that is now `MANAGER`.
 * A stored `MANAGER` is not remapped here — that value is already the current
 * Manager after migration. Pre-migration Manager rows are renamed to Team Lead
 * in `ensureHierarchyMigration` before they are read.
 */
export function normalizeRole(role: string | null | undefined): Role {
  if (role === "ADMIN" || role === "MANAGER" || role === "TEAM_LEAD" || role === "TEAM_MEMBER") {
    return role;
  }
  if (role === "SUPER_MANAGER") return "MANAGER";
  return "TEAM_MEMBER";
}

export const PLATFORM_STATUS_LABELS: Record<PlatformStatus, string> = {
  open: "Not started",
  pending: "In progress",
  done: "Complete",
  na: "Not needed",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Completed",
  blocked: "Blocked",
};

export const PUBLIC_MILESTONE_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Completed",
  blocked: "Blocked",
};

export const ACTIVITY_KINDS = [
  "note",
  "status",
  "credential",
  "stock",
  "sale",
  "health",
  "ads",
  "profile",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const PLAN_OPTIONS = [
  { value: "all", label: "All platforms" },
  { value: "amazon-only", label: "Amazon only / FBA" },
] as const;

export const COLUMN_VALUE_TYPES = [
  "identity",
  "contact",
  "badge",
  "money",
  "platforms",
  "owner",
  "text",
  "date",
] as const;
export type ColumnValueType = (typeof COLUMN_VALUE_TYPES)[number];

export const CUSTOM_COLUMN_TYPES = ["text", "money", "date"] as const;
export type CustomColumnType = (typeof CUSTOM_COLUMN_TYPES)[number];

export type ColumnKind = "builtin" | "custom";
export type ColumnVisibility = Record<Role, boolean>;

export type ClientColumn = {
  key: string;
  label: string;
  kind: ColumnKind;
  type: ColumnValueType;
  sortOrder: number;
  visible: ColumnVisibility;
};

export const CUSTOM_COLUMN_TYPE_LABELS: Record<CustomColumnType, string> = {
  text: "Text",
  money: "Amount",
  date: "Date",
};
