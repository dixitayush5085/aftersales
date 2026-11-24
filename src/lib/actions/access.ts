"use server";

import { revalidatePath } from "next/cache";
import { dbConnect } from "@/lib/db";
import { clearAccessCache, getAccessMatrix, hasPermission } from "@/lib/access";
import { isLocked } from "@/lib/access-policy";
import { requireUser } from "@/lib/rbac";
import { RoleAccess } from "@/models/access";
import { AuditLog } from "@/models/ops";
import { PERMISSIONS, ROLES, type Permission, type Role } from "@/types";

export async function loadAccessMatrix() {
  const user = await requireUser();
  if (!(await hasPermission(user.role, "manageAccess"))) {
    throw new Error("Forbidden");
  }
  return getAccessMatrix();
}

export async function setRolePermission(role: Role, permission: Permission, enabled: boolean) {
  const user = await requireUser();
  if (!(await hasPermission(user.role, "manageAccess"))) {
    throw new Error("Forbidden");
  }
  if (!PERMISSIONS.includes(permission)) throw new Error("Unknown action");
  if (!ROLES.includes(role)) throw new Error("Unknown role");
  if (permission === "manageAccess" && role !== "ADMIN") throw new Error("Forbidden");
  if (isLocked(role, permission)) throw new Error("This action is fixed for that role");

  await dbConnect();
  const current = await RoleAccess.findOne({ role }).lean();
  const next = { ...((current?.permissions as Record<string, boolean> | undefined) ?? {}), [permission]: enabled };
  await RoleAccess.updateOne({ role }, { $set: { permissions: next } }, { upsert: true });
  clearAccessCache();

  await AuditLog.create({
    actorId: user.id,
    action: "access.update",
    entityType: "role",
    entityId: role,
    meta: { permission, enabled },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/access");
  revalidatePath("/inbox");
  revalidatePath("/clients");
  revalidatePath("/admin/users");
}
