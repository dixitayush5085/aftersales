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
import { nextRole, ROLES, type Role } from "@/types";

export async function inviteUser(input: {
  name: string;
  email: string;
  role: Role;
  reportsTo?: string;
  managerId?: string;
  groupId?: string;
}) {
  const actor = await requireUser();
  if (!(await canInviteUsers(actor.role))) throw new Error("Forbidden");
  if (input.role === "ADMIN" && actor.role !== "ADMIN") throw new Error("Forbidden");
  if (!ROLES.includes(input.role)) throw new Error("Invalid role");

  await dbConnect();
  const email = input.email.trim().toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) throw new Error("Email already invited");

  let managerId = input.managerId || null;
  let groupId = input.groupId || null;

  if (input.role === "TEAM_MEMBER") {
    managerId = input.reportsTo || managerId;
    if (managerId) {
      const manager = await User.findOne({ _id: managerId, role: "MANAGER" });
      if (!manager) throw new Error("Select a Manager for this Account Manager");
      groupId = manager.groupId ? String(manager.groupId) : groupId;
    }
  }

  if (input.role === "MANAGER") {
    managerId = null;
    const smId = input.reportsTo;
    if (smId) {
      const sm = await User.findOne({ _id: smId, role: "SUPER_MANAGER" });
      if (!sm) throw new Error("Select a Super Manager for this Manager");
      let group = await Group.findOne({ smUserId: sm._id });
      if (!group) {
        group = await Group.create({ name: `${sm.name}'s group`, smUserId: sm._id });
      }
      groupId = String(group._id);
    }
  }

  if (input.role === "SUPER_MANAGER" || input.role === "ADMIN") {
    managerId = null;
    groupId = null;
  }

  const inviteToken = newAccessToken();
  const user = await User.create({
    name: input.name.trim(),
    email,
    role: input.role,
    isActive: false,
    managerId,
    groupId,
    inviteToken,
  });

  revalidatePath("/admin/users");
  return { id: String(user._id), inviteToken };
}

export async function createGroup(name: string, smUserId: string) {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") throw new Error("Forbidden");
  await dbConnect();
  const sm = await User.findOne({ _id: smUserId, role: "SUPER_MANAGER" });
  if (!sm) throw new Error("Super Manager not found");
  const group = await Group.create({ name: name.trim(), smUserId: sm._id });
  revalidatePath("/admin/groups");
  return { id: String(group._id) };
}

function newAccessToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function setReportsTo(userId: string, reportsToId: string) {
  const actor = await requireUser();
  if (!(await canSetReportsTo(actor.role))) {
    throw new Error("Forbidden");
  }
  await dbConnect();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.role === "TEAM_MEMBER") {
    const manager = await User.findOne({ _id: reportsToId, role: "MANAGER" });
    if (!manager) throw new Error("Select a Manager");
    if (actor.role === "SUPER_MANAGER") {
      const ids = await visibleUserIds(actor);
      if (ids !== "all" && !ids.includes(String(manager._id))) {
        throw new Error("Forbidden");
      }
    }
    user.managerId = manager._id;
    user.groupId = manager.groupId ?? null;
  } else if (user.role === "MANAGER") {
    const sm = await User.findOne({ _id: reportsToId, role: "SUPER_MANAGER" });
    if (!sm) throw new Error("Select a Super Manager");
    if (actor.role === "SUPER_MANAGER" && String(sm._id) !== actor.id) {
      throw new Error("Forbidden");
    }
    let group = await Group.findOne({ smUserId: sm._id });
    if (!group) {
      group = await Group.create({ name: `${sm.name}'s group`, smUserId: sm._id });
    }
    user.groupId = group._id;
    user.managerId = null;
  } else {
    throw new Error("This role does not report to someone");
  }

  await user.save();
  revalidatePath("/admin/users");
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

  const target = nextRole(user.role as Role);
  if (!target) throw new Error("This person cannot be promoted further");

  if (target === "MANAGER") {
    const previousManager = user.managerId
      ? await User.findById(user.managerId)
      : null;
    user.role = "MANAGER";
    user.managerId = null;
    if (!user.groupId && previousManager?.groupId) {
      user.groupId = previousManager.groupId;
    }
    if (!user.groupId && actor.role === "SUPER_MANAGER") {
      let group = await Group.findOne({ smUserId: actor.id });
      if (!group) {
        group = await Group.create({ name: `${actor.name || "Team"}'s group`, smUserId: actor.id });
      }
      user.groupId = group._id;
    }
  }

  if (target === "SUPER_MANAGER") {
    user.role = "SUPER_MANAGER";
    user.managerId = null;
    user.groupId = null;
    const existingGroup = await Group.findOne({ smUserId: user._id });
    if (!existingGroup) {
      await Group.create({ name: `${user.name}'s group`, smUserId: user._id });
    }
    await User.updateMany({ managerId: user._id }, { $set: { managerId: null } });
  }

  await user.save();
  revalidatePath("/admin/users");
  return { id: String(user._id), role: user.role as Role };
}

export async function listStaff() {
  const actor = await requireUser();
  if (!(await canAccessTeam(actor.role))) return [];
  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (actor.role === "MANAGER") {
    filter.$or = [{ managerId: new Types.ObjectId(actor.id) }, { _id: new Types.ObjectId(actor.id) }];
  } else if (actor.role === "SUPER_MANAGER") {
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
    role: u.role as Role,
    isActive: Boolean(u.isActive),
    managerId: u.managerId ? String(u.managerId) : "",
    groupId: u.groupId ? String(u.groupId) : "",
    inviteToken: String(u.inviteToken || ""),
  }));
}

export async function listGroups() {
  await dbConnect();
  const groups = await Group.find().lean();
  return groups.map((g) => ({
    id: String(g._id),
    name: g.name,
    smUserId: String(g.smUserId),
  }));
}
