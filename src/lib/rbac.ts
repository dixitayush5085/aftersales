import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/access";
import { dbConnect } from "@/lib/db";
import { Group } from "@/models/group";
import { User } from "@/models/user";
import { normalizeRole, type Role } from "@/types";

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
  return { ...session.user, role: normalizeRole(session.user.role) };
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

async function leadIdsForManager(managerId: string) {
  const direct = await User.find({ role: "TEAM_LEAD", managerId }).select("_id").lean();
  const groups = await Group.find({ smUserId: managerId }).select("_id").lean();
  const legacy = groups.length
    ? await User.find({
        role: "TEAM_LEAD",
        groupId: { $in: groups.map((g) => g._id) },
        $or: [{ managerId: null }, { managerId: { $exists: false } }],
      })
        .select("_id")
        .lean()
    : [];
  const ids = new Map<string, Types.ObjectId>();
  for (const row of [...direct, ...legacy]) ids.set(String(row._id), row._id as Types.ObjectId);
  return [...ids.values()];
}

export async function visibleUserIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.role === "ADMIN") return "all";

  await dbConnect();

  if (user.role === "TEAM_MEMBER") {
    return [user.id];
  }

  if (user.role === "TEAM_LEAD") {
    const team = await User.find({ role: "TEAM_MEMBER", managerId: user.id }).select("_id").lean();
    return [user.id, ...team.map((t) => String(t._id))];
  }

  if (user.role === "MANAGER") {
    const leadIds = await leadIdsForManager(user.id);
    const members = await User.find({ role: "TEAM_MEMBER", managerId: { $in: leadIds } })
      .select("_id")
      .lean();
    return [user.id, ...leadIds.map((id) => String(id)), ...members.map((m) => String(m._id))];
  }

  return [user.id];
}

/** Team members this user is allowed to assign. Caller must already have assignClients. */
export async function assignableTeamMemberIds(user: SessionUser): Promise<string[] | "all"> {
  await dbConnect();
  if (user.role === "ADMIN") return "all";

  if (user.role === "TEAM_LEAD") {
    const team = await User.find({ role: "TEAM_MEMBER", isActive: true, managerId: user.id })
      .select("_id")
      .lean();
    return team.map((t) => String(t._id));
  }

  if (user.role === "MANAGER") {
    const leadIds = await leadIdsForManager(user.id);
    const team = await User.find({
      role: "TEAM_MEMBER",
      isActive: true,
      managerId: { $in: leadIds },
    })
      .select("_id")
      .lean();
    return team.map((t) => String(t._id));
  }

  return [];
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
