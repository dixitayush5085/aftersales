import { dbConnect } from "@/lib/db";
import { mergeRoleAccess } from "@/lib/access-policy";
import { RoleAccess } from "@/models/access";
import { normalizeRole, type Permission, type PermissionSet, type Role } from "@/types";

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
  const byRole = new Map(rows.map((row) => [String(row.role), row.permissions as Partial<PermissionSet>]));
  const legacy = byRole.has("SUPER_MANAGER");
  const pick = (role: Role) => {
    if (!legacy) return byRole.get(role);
    if (role === "MANAGER") return byRole.get("SUPER_MANAGER");
    if (role === "TEAM_LEAD") return byRole.get("MANAGER");
    return byRole.get(role);
  };
  const matrix = {
    ADMIN: mergeRoleAccess("ADMIN", pick("ADMIN")),
    MANAGER: mergeRoleAccess("MANAGER", pick("MANAGER")),
    TEAM_LEAD: mergeRoleAccess("TEAM_LEAD", pick("TEAM_LEAD")),
    TEAM_MEMBER: mergeRoleAccess("TEAM_MEMBER", pick("TEAM_MEMBER")),
  };
  cache = { at: Date.now(), matrix };
  return matrix;
}

export async function permissionsFor(role: Role): Promise<PermissionSet> {
  const matrix = await getAccessMatrix();
  return matrix[normalizeRole(role)];
}

export async function hasPermission(role: Role, permission: Permission) {
  const set = await permissionsFor(role);
  return Boolean(set[permission]);
}
