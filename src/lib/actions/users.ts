"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { dbConnect } from "@/lib/db";
import { Types } from "mongoose";
import {
  canAccessTeam,
  canInviteUsers,
  canPromoteUsers,
  canSetReportsTo,
  requireUser,
  visibleUserIds,
} from "@/lib/rbac";
import { Group } from "@/models/group";
import { User } from "@/models/user";
import { canGrantRole, nextRole, normalizeRole, ROLES, type Role } from "@/types";

export async function inviteUser(input: {
  name: string;
  email: string;
  role: Role;
  reportsTo?: string;
}) {
  const actor = await requireUser();
  if (!(await canInviteUsers(actor.role))) throw new Error("Forbidden");
  const role = normalizeRole(input.role);
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  if (!canGrantRole(actor.role, role)) throw new Error("Forbidden");

  await dbConnect();
  const email = input.email.trim().toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) throw new Error("Email already invited");

  let managerId: string | null = null;

  if (role === "TEAM_MEMBER") {
    let leadId = input.reportsTo || null;
    if (!leadId && actor.role === "TEAM_LEAD") leadId = actor.id;
    if (leadId) {
      const lead = await User.findOne({ _id: leadId, role: "TEAM_LEAD" });
      if (!lead) throw new Error("Select a Team Lead for this Team Member");
      if (actor.role === "TEAM_LEAD" && String(lead._id) !== actor.id) throw new Error("Forbidden");
      if (actor.role === "MANAGER" && String(lead.managerId || "") !== actor.id) {
        throw new Error("Forbidden");
      }
      managerId = String(lead._id);
    }
  }

  if (role === "TEAM_LEAD") {
    if (actor.role === "MANAGER") {
      managerId = actor.id;
    } else if (input.reportsTo) {
      const manager = await User.findOne({ _id: input.reportsTo, role: "MANAGER" });
      if (!manager) throw new Error("Select a Manager for this Team Lead");
      managerId = String(manager._id);
    }
  }

  const inviteToken = newAccessToken();
  const user = await User.create({
    name: input.name.trim(),
    email,
    role,
    isActive: false,
    managerId,
    groupId: null,
    inviteToken,
  });

  revalidateTeam();
  return { id: String(user._id), inviteToken };
}

export async function createGroup(name: string, managerUserId: string) {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") throw new Error("Forbidden");
  await dbConnect();
  const manager = await User.findOne({ _id: managerUserId, role: "MANAGER" });
  if (!manager) throw new Error("Manager not found");
  const group = await Group.create({ name: name.trim(), smUserId: manager._id });
  revalidatePath("/admin/groups");
  return { id: String(group._id) };
}

function newAccessToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function revalidateTeam() {
  revalidatePath("/admin/users");
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/inbox");
}

export async function setReportsTo(userId: string, reportsToId: string) {
  const actor = await requireUser();
  if (!(await canSetReportsTo(actor.role))) {
    throw new Error("Forbidden");
  }
  await dbConnect();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const role = normalizeRole(user.role);

  if (actor.role !== "ADMIN") {
    const ids = await visibleUserIds(actor);
    if (ids !== "all" && !ids.includes(String(user._id))) throw new Error("Forbidden");
  }

  if (role === "TEAM_MEMBER") {
    const lead = await User.findOne({ _id: reportsToId, role: "TEAM_LEAD" });
    if (!lead) throw new Error("Select a Team Lead");
    if (actor.role === "TEAM_LEAD" && String(lead._id) !== actor.id) throw new Error("Forbidden");
    if (actor.role === "MANAGER" && String(lead.managerId || "") !== actor.id) {
      throw new Error("Forbidden");
    }
    user.managerId = lead._id;
    user.groupId = null;
  } else if (role === "TEAM_LEAD") {
    const manager = await User.findOne({ _id: reportsToId, role: "MANAGER" });
    if (!manager) throw new Error("Select a Manager");
    if (actor.role !== "ADMIN" && String(manager._id) !== actor.id) throw new Error("Forbidden");
    user.managerId = manager._id;
    user.groupId = null;
  } else {
    throw new Error("This role does not report to someone");
  }

  await user.save();
  revalidateTeam();
}

export async function promoteUser(userId: string) {
  const actor = await requireUser();
  if (!(await canPromoteUsers(actor.role))) throw new Error("Forbidden");
  if (actor.id === userId) throw new Error("You cannot promote yourself");

  await dbConnect();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (actor.role !== "ADMIN") {
    const ids = await visibleUserIds(actor);
    if (ids !== "all" && !ids.includes(String(user._id))) {
      throw new Error("Forbidden");
    }
  }

  const current = normalizeRole(user.role);
  const target = nextRole(current);
  if (!target) throw new Error("This person cannot be promoted further");
  if (!canGrantRole(actor.role, target)) throw new Error("Forbidden");

  if (target === "TEAM_LEAD") {
    const previousLead = user.managerId ? await User.findById(user.managerId) : null;
    user.role = "TEAM_LEAD";
    user.groupId = null;
    if (previousLead?.role === "TEAM_LEAD" && previousLead.managerId) {
      user.managerId = previousLead.managerId;
    } else if (actor.role === "MANAGER") {
      user.managerId = new Types.ObjectId(actor.id);
    } else {
      user.managerId = null;
    }
  } else if (target === "MANAGER") {
    user.role = "MANAGER";
    user.managerId = null;
    user.groupId = null;
    await User.updateMany({ managerId: user._id }, { $set: { managerId: null } });
  }

  await user.save();
  revalidateTeam();
  return { id: String(user._id), role: user.role as Role };
}

export async function listStaff() {
  const actor = await requireUser();
  if (!(await canAccessTeam(actor.role))) return [];
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (actor.role !== "ADMIN") {
    const ids = await visibleUserIds(actor);
    if (ids !== "all") {
      filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    }
  }

  const users = await User.find(filter)
    .select("name email role isActive managerId groupId inviteToken")
    .sort({ createdAt: -1 })
    .lean();

  const missing = users.filter((u) => !u.inviteToken);
  if (missing.length) {
    await Promise.all(
      missing.map((u) =>
        User.updateOne({ _id: u._id }, { $set: { inviteToken: newAccessToken() }, $unset: { inviteExpiresAt: 1 } }),
      ),
    );
  }

  const refreshed =
    missing.length === 0
      ? users
      : await User.find(filter)
          .select("name email role isActive managerId groupId inviteToken")
          .sort({ createdAt: -1 })
          .lean();

  return refreshed.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: normalizeRole(String(u.role)),
    isActive: Boolean(u.isActive),
    managerId: u.managerId ? String(u.managerId) : "",
    groupId: u.groupId ? String(u.groupId) : "",
    inviteToken: String(u.inviteToken || ""),
  }));
}

export async function listGroups() {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") return [];
  await dbConnect();
  const groups = await Group.find().lean();
  return groups.map((g) => ({
    id: String(g._id),
    name: g.name,
    smUserId: String(g.smUserId),
  }));
}
