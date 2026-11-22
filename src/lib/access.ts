import { dbConnect } from "@/lib/db";
import { mergeRoleAccess } from "@/lib/access-policy";
import { RoleAccess } from "@/models/access";
import type { Permission, PermissionSet, Role } from "@/types";

export { CONFIGURABLE_ROLES, isLocked } from "@/lib/access-policy";

let cache: { at: number; matrix: Record<Role, PermissionSet> } | null = null;
const CACHE_MS = 4_000;

export function clearAccessCache() {
  cache = null;
}

export async function getAccessMatrix(): Promise<Record<Role, PermissionSet>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.matrix;
  await dbConnect();
  const rows = await RoleAccess.find().lean();
  const byRole = new Map(rows.map((row) => [row.role as Role, row.permissions as Partial<PermissionSet>]));
  const matrix = {
    ADMIN: mergeRoleAccess("ADMIN", byRole.get("ADMIN")),
    SUPER_MANAGER: mergeRoleAccess("SUPER_MANAGER", byRole.get("SUPER_MANAGER")),
    MANAGER: mergeRoleAccess("MANAGER", byRole.get("MANAGER")),
    TEAM_MEMBER: mergeRoleAccess("TEAM_MEMBER", byRole.get("TEAM_MEMBER")),
  };
  cache = { at: Date.now(), matrix };
  return matrix;
}

export async function permissionsFor(role: Role): Promise<PermissionSet> {
  const matrix = await getAccessMatrix();
  return matrix[role];
}

export async function hasPermission(role: Role, permission: Permission) {
  const set = await permissionsFor(role);
  return Boolean(set[permission]);
}
