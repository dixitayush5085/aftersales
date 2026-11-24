import {
  PERMISSIONS,
  type Permission,
  type PermissionSet,
  type Role,
} from "@/types";

export const CONFIGURABLE_ROLES: Role[] = ["MANAGER", "TEAM_LEAD", "TEAM_MEMBER"];

const empty = (): PermissionSet =>
  Object.fromEntries(PERMISSIONS.map((key) => [key, false])) as PermissionSet;

export const DEFAULT_ACCESS: Record<Role, PermissionSet> = {
  ADMIN: {
    assignClients: false,
    accessTeam: true,
    inviteUsers: true,
    promoteUsers: true,
    setReportsTo: true,
    viewRolledBack: true,
    manageAccess: true,
  },
  MANAGER: {
    assignClients: true,
    accessTeam: true,
    inviteUsers: true,
    promoteUsers: true,
    setReportsTo: true,
    viewRolledBack: false,
    manageAccess: false,
  },
  TEAM_LEAD: {
    assignClients: false,
    accessTeam: true,
    inviteUsers: false,
    promoteUsers: false,
    setReportsTo: false,
    viewRolledBack: false,
    manageAccess: false,
  },
  TEAM_MEMBER: {
    assignClients: false,
    accessTeam: false,
    inviteUsers: false,
    promoteUsers: false,
    setReportsTo: false,
    viewRolledBack: false,
    manageAccess: false,
  },
};

/** Forced values. Admin never assigns; only Admin configures access. */
export const ACCESS_LOCKS: Record<Role, Partial<PermissionSet>> = {
  ADMIN: {
    assignClients: false,
    accessTeam: true,
    inviteUsers: true,
    promoteUsers: true,
    setReportsTo: true,
    viewRolledBack: true,
    manageAccess: true,
  },
  MANAGER: { manageAccess: false },
  TEAM_LEAD: { manageAccess: false },
  TEAM_MEMBER: { manageAccess: false },
};

export function isLocked(role: Role, permission: Permission) {
  return ACCESS_LOCKS[role]?.[permission] !== undefined;
}

export function applyAccessLocks(role: Role, set: PermissionSet): PermissionSet {
  return { ...set, ...ACCESS_LOCKS[role] };
}

export function mergeRoleAccess(role: Role, stored?: Partial<PermissionSet> | null): PermissionSet {
  return applyAccessLocks(role, { ...empty(), ...DEFAULT_ACCESS[role], ...(stored ?? {}) });
}
