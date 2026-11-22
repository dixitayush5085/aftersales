import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/access";
import { dbConnect } from "@/lib/db";
import { Group } from "@/models/group";
import { User } from "@/models/user";
import type { Role } from "@/types";

export type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function canManageUsers(role: Role) {
  return hasPermission(role, "inviteUsers");
}

export async function canInviteUsers(role: Role) {
  return hasPermission(role, "inviteUsers");
}

export async function canPromoteUsers(role: Role) {
  return hasPermission(role, "promoteUsers");
}

export async function canSetReportsTo(role: Role) {
  return hasPermission(role, "setReportsTo");
}

export async function canAccessTeam(role: Role) {
  return hasPermission(role, "accessTeam");
}

export async function canAssignClients(role: Role) {
  return hasPermission(role, "assignClients");
}

export async function canSeeRolledBack(role: Role) {
  return hasPermission(role, "viewRolledBack");
}

export async function canManageAccess(role: Role) {
  return hasPermission(role, "manageAccess");
}

export async function visibleUserIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.role === "ADMIN") return "all";

  await dbConnect();

  if (user.role === "TEAM_MEMBER") {
    return [user.id];
  }

  if (user.role === "MANAGER") {
    const team = await User.find({ managerId: user.id, isActive: true })
      .select("_id")
      .lean();
    return [user.id, ...team.map((t) => String(t._id))];
  }

  const groups = await Group.find({ smUserId: user.id }).select("_id").lean();
  const groupIds = groups.map((g) => g._id);
  const managers = await User.find({
    groupId: { $in: groupIds },
    role: "MANAGER",
  })
    .select("_id")
    .lean();
  const managerIds = managers.map((m) => String(m._id));
  const ams = await User.find({
    managerId: { $in: managerIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();
  return [user.id, ...managerIds, ...ams.map((a) => String(a._id))];
}

export async function clientMatchFor(user: SessionUser): Promise<Record<string, unknown>> {
  if (user.role === "ADMIN") {
    return { lifecycleStatus: "active" };
  }

  if (user.role === "TEAM_MEMBER") {
    return {
      lifecycleStatus: "active",
      $or: [
        { primaryAmId: new Types.ObjectId(user.id) },
        { _id: { $in: await assignedClientIds(user.id) } },
      ],
    };
  }

  const ids = await visibleUserIds(user);
  const objectIds = ids === "all" ? [] : ids.map((id) => new Types.ObjectId(id));

  return {
    lifecycleStatus: "active",
    primaryAmId: { $in: objectIds },
  };
}

async function assignedClientIds(userId: string) {
  const { Assignment } = await import("@/models/ops");
  const rows = await Assignment.find({ userId }).select("clientId").lean();
  return rows.map((r) => r.clientId);
}

export async function assertCanAccessClient(user: SessionUser, clientId: string) {
  const { Client } = await import("@/models/client");
  await dbConnect();
  const match = await clientMatchFor(user);
  const client = await Client.findOne({
    _id: new Types.ObjectId(clientId),
    ...match,
  } as never).lean();
  if (!client && user.role !== "ADMIN") {
    const fallback = await Client.findById(clientId).lean();
    if (!fallback || fallback.lifecycleStatus === "rolled_back") {
      throw new Error("Not found");
    }
    throw new Error("Forbidden");
  }
  if (!client) {
    const adminClient = await Client.findById(clientId).lean();
    if (!adminClient) throw new Error("Not found");
    return adminClient;
  }
  return client;
}
