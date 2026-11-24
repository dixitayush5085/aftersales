"use server";

import { revalidatePath } from "next/cache";
import { dbConnect } from "@/lib/db";
import { hasPermission } from "@/lib/access";
import { clearColumnCache, getColumnCatalog } from "@/lib/columns";
import { isColumnLocked } from "@/lib/columns-policy";
import { requireUser } from "@/lib/rbac";
import { ClientColumnModel } from "@/models/column";
import { AuditLog } from "@/models/ops";
import {
  CUSTOM_COLUMN_TYPES,
  ROLES,
  type CustomColumnType,
  type Role,
} from "@/types";

function assertAdminAccess(role: Role) {
  return hasPermission(role, "manageAccess");
}

function revalidateClients() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/access");
  revalidatePath("/clients");
  revalidatePath("/inbox");
}

export async function setColumnVisibility(key: string, role: Role, enabled: boolean) {
  const user = await requireUser();
  if (!(await assertAdminAccess(user.role))) throw new Error("Forbidden");
  if (!ROLES.includes(role)) throw new Error("Unknown role");
  if (isColumnLocked(key, role)) throw new Error("This column is fixed for that role");

  await dbConnect();
  const column = await ClientColumnModel.findOne({ key });
  if (!column) throw new Error("Column not found");
  if (role === "ADMIN" && !enabled && column.kind === "custom") {
    throw new Error("Admin always sees custom columns");
  }
  column.visible = { ...column.visible, [role]: enabled } as typeof column.visible;
  await column.save();
  clearColumnCache();

  await AuditLog.create({
    actorId: user.id,
    action: "column.visibility",
    entityType: "column",
    entityId: key,
    meta: { role, enabled },
  });
  revalidateClients();
}

function slugify(label: string) {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return base || "field";
}

export async function addClientColumn(input: {
  label: string;
  type: CustomColumnType;
  visible: Partial<Record<Role, boolean>>;
}) {
  const user = await requireUser();
  if (!(await assertAdminAccess(user.role))) throw new Error("Forbidden");

  const label = input.label.trim();
  if (label.length < 2) throw new Error("Give the column a name");
  if (!CUSTOM_COLUMN_TYPES.includes(input.type)) throw new Error("Unknown column type");

  await dbConnect();
  const catalog = await getColumnCatalog();
  let key = `c_${slugify(label)}`;
  if (catalog.some((col) => col.key === key)) {
    key = `${key}_${Math.random().toString(36).slice(2, 6)}`;
  }

  const sortOrder = catalog.reduce((max, col) => Math.max(max, col.sortOrder), 0) + 1;
  await ClientColumnModel.create({
    key,
    label,
    kind: "custom",
    type: input.type,
    sortOrder,
    visible: {
      ADMIN: true,
      MANAGER: Boolean(input.visible.MANAGER),
      TEAM_LEAD: Boolean(input.visible.TEAM_LEAD),
      TEAM_MEMBER: Boolean(input.visible.TEAM_MEMBER),
    },
  });
  clearColumnCache();

  await AuditLog.create({
    actorId: user.id,
    action: "column.create",
    entityType: "column",
    entityId: key,
    meta: { label, type: input.type },
  });
  revalidateClients();
  return { key };
}

export async function renameClientColumn(key: string, label: string) {
  const user = await requireUser();
  if (!(await assertAdminAccess(user.role))) throw new Error("Forbidden");
  const next = label.trim();
  if (next.length < 2) throw new Error("Give the column a name");

  await dbConnect();
  const column = await ClientColumnModel.findOne({ key, kind: "custom" });
  if (!column) throw new Error("Only custom columns can be renamed");
  column.label = next;
  await column.save();
  clearColumnCache();
  revalidateClients();
}

export async function deleteClientColumn(key: string) {
  const user = await requireUser();
  if (!(await assertAdminAccess(user.role))) throw new Error("Forbidden");

  await dbConnect();
  const column = await ClientColumnModel.findOne({ key, kind: "custom" });
  if (!column) throw new Error("Only custom columns can be removed");
  await ClientColumnModel.deleteOne({ key });
  clearColumnCache();

  await AuditLog.create({
    actorId: user.id,
    action: "column.delete",
    entityType: "column",
    entityId: key,
    meta: { label: column.label },
  });
  revalidateClients();
}
