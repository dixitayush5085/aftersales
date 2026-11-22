export const ROLES = [
  "ADMIN",
  "SUPER_MANAGER",
  "MANAGER",
  "TEAM_MEMBER",
] as const;

export type Role = (typeof ROLES)[number];

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
  SUPER_MANAGER: "Super Manager",
  MANAGER: "Manager",
  TEAM_MEMBER: "Account Manager",
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
    description: "See Unassigned and give converted clients to an account manager.",
  },
  accessTeam: {
    label: "View team",
    description: "Open the Team page and copy invite / password links.",
  },
  inviteUsers: {
    label: "Invite people",
    description: "Send invites for Super Manager, Manager, or Account Manager.",
  },
  promoteUsers: {
    label: "Promote",
    description: "Promote Account Manager → Manager → Super Manager.",
  },
  setReportsTo: {
    label: "Link reporting",
    description: "Attach an Account Manager to a Manager, or a Manager to a Super Manager.",
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
  if (role === "TEAM_MEMBER") return "MANAGER";
  if (role === "MANAGER") return "SUPER_MANAGER";
  return null;
}

export const PLATFORM_STATUS_LABELS: Record<PlatformStatus, string> = {
  open: "Not started",
  pending: "In progress",
  done: "Complete",
  na: "Not needed",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Waiting",
  in_progress: "In progress",
  done: "Done",
  blocked: "Needs attention",
};

export const PUBLIC_MILESTONE_LABELS: Record<MilestoneStatus, string> = {
  pending: "Queued",
  in_progress: "In progress",
  done: "Complete",
  blocked: "We're on it",
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
