import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { canSeeColumn, columnsForRole } from "@/lib/columns";
import { milestoneProgress } from "@/lib/progress";
import {
  canAssignClients,
  canSeeRolledBack,
  clientMatchFor,
  visibleUserIds,
  type SessionUser,
} from "@/lib/rbac";
import { ClientActivity } from "@/models/activity";
import { Client } from "@/models/client";
import { SaleLog, Target } from "@/models/ops";
import { User } from "@/models/user";
import { Milestone, PlatformAccount } from "@/models/platform";
import { idString } from "@/lib/utils";
import { normalizeRole, type ClientColumn, type Platform, type PlatformStatus, type Role } from "@/types";

export type ClientListItem = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  state: string;
  city: string;
  gstStatus: string;
  salesAmount: number | null;
  saleDate: string | null;
  sourceCode: string;
  companyName: string;
  lifecycleStatus: string;
  primaryAmId: string;
  primaryAmName: string;
  createdAt: string;
  customFields: Record<string, string>;
  platforms: { platform: Platform; status: PlatformStatus }[];
};

function asCustomFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      entry == null ? "" : String(entry),
    ]),
  );
}

const PAGE_SIZE = 25;

export async function listClients(opts: {
  user: SessionUser;
  page?: number;
  q?: string;
  unassignedOnly?: boolean;
}) {
  await dbConnect();
  const page = Math.max(1, opts.page ?? 1);
  const [match, visibleCols] = await Promise.all([
    clientMatchFor(opts.user),
    columnsForRole(opts.user.role),
  ]);
  const show = new Set(visibleCols.map((col) => col.key));
  const canAmount = show.has("planAmount");
  const filter: Record<string, unknown> = { ...match };

  if (opts.unassignedOnly) {
    filter.lifecycleStatus = "active";
    filter.primaryAmId = null;
  }

  if (opts.q?.trim()) {
    const q = opts.q.trim();
    const search = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    };
    const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
    filter.$and = [...existingAnd, search];
  }

  const [total, rows] = await Promise.all([
    Client.countDocuments(filter as never),
    Client.find(filter as never)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ]);

  const amIds = rows
    .map((r) => r.primaryAmId)
    .filter(Boolean)
    .map((id) => new Types.ObjectId(String(id)));
  const ams = amIds.length
    ? await User.find({ _id: { $in: amIds } }).select("name").lean()
    : [];
  const amMap = new Map(ams.map((a) => [String(a._id), a.name]));

  const clientIds = rows.map((r) => r._id);
  const platforms = show.has("platforms")
    ? await PlatformAccount.find({ clientId: { $in: clientIds } }).lean()
    : [];
  const byClient = new Map<string, { platform: Platform; status: PlatformStatus }[]>();
  for (const p of platforms) {
    const key = String(p.clientId);
    const list = byClient.get(key) ?? [];
    list.push({ platform: p.platform as Platform, status: p.status as PlatformStatus });
    byClient.set(key, list);
  }

  const items: ClientListItem[] = rows.map((r) => ({
    id: idString(r._id),
    name: r.name || "Unnamed",
    mobile: show.has("contact") ? r.mobile : "",
    email: show.has("contact") ? r.email || "" : "",
    state: show.has("state") ? r.state || "" : "",
    city: show.has("city") ? r.city || "" : "",
    gstStatus: r.gstStatus,
    salesAmount: canAmount ? r.salesAmount ?? 0 : null,
    saleDate: show.has("saleDate") && r.saleDate ? new Date(r.saleDate).toISOString() : null,
    sourceCode: show.has("sourceCode") ? r.sourceCode || "" : "",
    companyName: r.companyName || "",
    lifecycleStatus: r.lifecycleStatus,
    primaryAmId: r.primaryAmId ? String(r.primaryAmId) : "",
    primaryAmName: show.has("owner") && r.primaryAmId ? amMap.get(String(r.primaryAmId)) || "" : "",
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
    customFields: (() => {
      const raw = asCustomFields((r as { customFields?: unknown }).customFields);
      return Object.fromEntries(
        visibleCols
          .filter((col) => col.kind === "custom")
          .map((col) => [col.key, raw[col.key] ?? ""]),
      );
    })(),
    platforms: byClient.get(String(r._id)) ?? [],
  }));

  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getDashboard(user: SessionUser) {
  await dbConnect();
  const match = await clientMatchFor(user);
  const canInbox = await canAssignClients(user.role);
  const canRolled = await canSeeRolledBack(user.role);
  const canAmount = await canSeeColumn(user.role, "planAmount");

  const [active, unassignedCount, rolledBack] = await Promise.all([
    Client.countDocuments({ ...match, lifecycleStatus: "active" } as never),
    canInbox
      ? Client.countDocuments({ lifecycleStatus: "active", primaryAmId: null })
      : Promise.resolve(0),
    canRolled
      ? Client.countDocuments({ lifecycleStatus: "rolled_back" })
      : Promise.resolve(0),
  ]);

  const unassigned = canInbox
    ? await Client.find({ lifecycleStatus: "active", primaryAmId: null })
        .sort({ createdAt: -1 })
        .limit(6)
        .select(canAmount ? "name companyName mobile createdAt salesAmount" : "name companyName mobile createdAt")
        .lean()
    : [];

  const recent = await Client.find({ ...match, lifecycleStatus: "active" } as never)
    .sort({ createdAt: -1 })
    .limit(6)
    .select("name companyName mobile createdAt primaryAmId")
    .lean();

  const scoped = await Client.find({ ...match, lifecycleStatus: "active" } as never)
    .select("_id")
    .lean();
  const scopedIds = scoped.map((c) => c._id);
  const accounts = await PlatformAccount.find({
    clientId: { $in: scopedIds },
    status: { $ne: "na" },
  })
    .select("clientId platform status")
    .lean();
  const accountMap = new Map(accounts.map((a) => [String(a._id), a]));
  const accountIds = accounts.map((a) => a._id);
  const [blocked, openSteps] = await Promise.all([
    Milestone.find({
      platformAccountId: { $in: accountIds },
      status: "blocked",
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
    accountIds.length
      ? Milestone.countDocuments({
          platformAccountId: { $in: accountIds },
          status: { $in: ["pending", "in_progress", "blocked"] },
        })
      : Promise.resolve(0),
  ]);
  const blockedClientIds = [
    ...new Set(
      blocked
        .map((m) => accountMap.get(String(m.platformAccountId)))
        .filter(Boolean)
        .map((account) => String(account!.clientId)),
    ),
  ];
  const blockedClients = blockedClientIds.length
    ? await Client.find({ _id: { $in: blockedClientIds } }).select("name companyName").lean()
    : [];
  const visibleMap = new Map(blockedClients.map((c) => [String(c._id), c]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scopeIds = await visibleUserIds(user);
  const targetFilter: Record<string, unknown> = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
  if (scopeIds !== "all") {
    targetFilter.userId = { $in: scopeIds.map((id) => new Types.ObjectId(id)) };
  }
  const [targets, achieved] = await Promise.all([
    Target.find(targetFilter).select("userId amount").lean(),
    scopedIds.length
      ? SaleLog.aggregate([
          { $match: { clientId: { $in: scopedIds }, soldAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
      : Promise.resolve([]),
  ]);
  const personal = targets.find((row) => String(row.userId) === user.id);
  const rolledTarget = targets.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return {
    counts: { active, unassigned: unassignedCount, rolledBack, openSteps },
    target: {
      amount: rolledTarget,
      personal: Number(personal?.amount ?? 0),
      achieved: Number(achieved[0]?.total ?? 0),
      monthLabel: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      scopeLabel:
        user.role === "ADMIN"
          ? "All active clients"
          : user.role === "MANAGER"
            ? "Your team leads and their members"
            : user.role === "TEAM_LEAD"
              ? "You and your team members"
              : "Clients assigned to you",
    },
    unassigned: unassigned.map((c) => ({
      id: idString(c._id),
      title: c.companyName || c.name || c.mobile,
      mobile: c.mobile,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
      salesAmount: canAmount ? c.salesAmount ?? 0 : null,
    })),
    recent: recent.map((c) => ({
      id: idString(c._id),
      title: c.companyName || c.name || c.mobile,
      mobile: c.mobile,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
    })),
    blocked: blocked.map((m) => {
      const account = accountMap.get(String(m.platformAccountId));
      const client = account ? visibleMap.get(String(account.clientId)) : null;
      return {
        id: idString(m._id),
        label: m.label,
        clientId: account ? String(account.clientId) : "",
        clientTitle: client ? client.companyName || client.name || "Client" : "Client",
        platform: (account?.platform as Platform) || "amazon",
      };
    }),
  };
}

export async function getClientShell(clientId: string) {
  await dbConnect();
  const client = await Client.findById(clientId)
    .select("name companyName planType lifecycleStatus trackingToken")
    .lean();
  if (!client) return null;
  const platforms = await PlatformAccount.find({ clientId: client._id }).select("status").lean();
  const milestones = await Milestone.find({
    platformAccountId: { $in: platforms.map((p) => p._id) },
  })
    .select("status platformAccountId")
    .lean();
  const byAccount = new Map<string, { status: string }[]>();
  for (const milestone of milestones) {
    const key = String(milestone.platformAccountId);
    const list = byAccount.get(key) ?? [];
    list.push(milestone);
    byAccount.set(key, list);
  }
  return {
    id: idString(client._id),
    name: client.name || "",
    companyName: client.companyName || "",
    planType: client.planType || "",
    lifecycleStatus: client.lifecycleStatus,
    trackingToken: client.trackingToken,
    progress: milestoneProgress(
      platforms.map((platform) => ({
        status: platform.status as PlatformStatus,
        milestones: byAccount.get(String(platform._id)) ?? [],
      })),
    ),
  };
}

export async function getClientOverview(clientId: string, role?: Role) {
  await dbConnect();
  const client = await Client.findById(clientId).lean();
  if (!client) return null;

  const [platforms, am, visible] = await Promise.all([
    PlatformAccount.find({ clientId: client._id }).lean(),
    client.primaryAmId ? User.findById(client.primaryAmId).select("name email").lean() : null,
    role ? columnsForRole(role) : Promise.resolve([] as ClientColumn[]),
  ]);
  const see = (key: string) => !role || visible.some((col) => col.key === key);
  const customFields = asCustomFields((client as { customFields?: unknown }).customFields);
  const customColumns = visible.filter((col) => col.kind === "custom");

  const milestones = await Milestone.find({
    platformAccountId: { $in: platforms.map((p) => p._id) },
  })
    .sort({ sortOrder: 1 })
    .lean();

  return {
    visibleKeys: visible.map((col) => col.key),
    customColumns,
    client: {
      id: idString(client._id),
      lmsLeadId: client.lmsLeadId,
      name: client.name || "",
      mobile: see("contact") ? client.mobile : "",
      email: see("contact") ? client.email || "" : "",
      state: see("state") ? client.state || "" : "",
      city: see("city") ? client.city || "" : "",
      address: client.address || "",
      pincode: client.pincode || "",
      gstStatus: client.gstStatus,
      salesAmount: see("planAmount") ? client.salesAmount ?? 0 : null,
      saleDate: see("saleDate") && client.saleDate ? new Date(client.saleDate).toISOString() : null,
      companyName: client.companyName || "",
      gstin: client.gstin || "",
      planType: client.planType || "",
      notes: client.notes || "",
      lifecycleStatus: client.lifecycleStatus,
      trackingToken: client.trackingToken,
      primaryAmId: client.primaryAmId ? String(client.primaryAmId) : "",
      primaryAmName: see("owner") ? am?.name || "" : "",
      sourceCode: see("sourceCode") ? client.sourceCode || "" : "",
      customFields: Object.fromEntries(
        customColumns.map((col) => [col.key, customFields[col.key] ?? ""]),
      ),
    },
    platforms: platforms.map((p) => ({
      id: idString(p._id),
      platform: p.platform as Platform,
      status: p.status as PlatformStatus,
      assigneeId: p.assigneeId ? String(p.assigneeId) : "",
      sellerLogin: p.sellerLogin || "",
      credentialHint: p.credentialHint || "",
      credentialUpdatedAt: p.credentialUpdatedAt
        ? new Date(p.credentialUpdatedAt).toISOString()
        : null,
      catalogNotes: p.catalogNotes || "",
      milestones: milestones
        .filter((m) => String(m.platformAccountId) === String(p._id))
        .map((m) => ({
          id: idString(m._id),
          key: m.key,
          label: m.label,
          status: m.status,
          notes: m.notes || "",
        })),
    })),
    progress: milestoneProgress(
      platforms.map((p) => ({
        status: p.status as PlatformStatus,
        milestones: milestones.filter((m) => String(m.platformAccountId) === String(p._id)),
      })),
    ),
  };
}

export async function listClientSales(clientId: string) {
  await dbConnect();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const clientObjectId = new Types.ObjectId(clientId);
  const [rows, month] = await Promise.all([
    SaleLog.find({ clientId: clientObjectId }).sort({ soldAt: -1 }).limit(40).lean(),
    SaleLog.aggregate([
      { $match: { clientId: clientObjectId, soldAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const actors = await User.find({
    _id: { $in: rows.map((row) => row.userId).filter(Boolean) },
  })
    .select("name role")
    .lean();
  const people = new Map(actors.map((a) => [String(a._id), a]));
  return {
    monthTotal: Number(month[0]?.total ?? 0),
    entries: rows.map((row) => {
      const actor = people.get(String(row.userId));
      return {
        id: idString(row._id),
        amount: Number(row.amount ?? 0),
        units: Number(row.units ?? 0),
        sku: row.sku || "",
        notes: row.notes || "",
        proofUrl: row.proofUrl || "",
        actorName: actor?.name || "Someone",
        actorRole: normalizeRole(actor?.role),
        soldAt: row.soldAt ? new Date(row.soldAt).toISOString() : "",
      };
    }),
  };
}

export async function listClientActivity(clientId: string) {
  await dbConnect();
  const rows = await ClientActivity.find({ clientId }).sort({ createdAt: -1 }).limit(100).lean();
  const actors = await User.find({
    _id: { $in: rows.map((row) => row.actorId).filter(Boolean) },
  })
    .select("name role")
    .lean();
  const people = new Map(actors.map((a) => [String(a._id), a]));
  return rows.map((row) => {
    const actor = people.get(String(row.actorId));
    return {
      id: idString(row._id),
      kind: row.kind,
      message: row.message,
      actorName: actor?.name || "Someone",
      actorRole: normalizeRole(actor?.role),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
    };
  });
}

export async function getPublicProgress(token: string) {
  await dbConnect();
  const client = await Client.findOne({
    trackingToken: token,
    lifecycleStatus: "active",
  })
    .select("name companyName")
    .lean();
  if (!client) return null;

  const platforms = await PlatformAccount.find({
    clientId: client._id,
    status: { $ne: "na" },
  })
    .select("platform status")
    .lean();
  const milestones = await Milestone.find({
    platformAccountId: { $in: platforms.map((p) => p._id) },
  })
    .select("platformAccountId label status sortOrder")
    .sort({ sortOrder: 1 })
    .lean();

  const publicPlatforms = platforms.map((p) => ({
    id: idString(p._id),
    platform: p.platform as Platform,
    status: p.status as PlatformStatus,
    milestones: milestones
      .filter((m) => String(m.platformAccountId) === String(p._id))
      .map((m) => ({
        id: idString(m._id),
        label: m.label,
        status: m.status,
      })),
  }));

  return {
    name: client.name || client.companyName || "Your account",
    companyName: client.companyName || "",
    progress: milestoneProgress(publicPlatforms),
    platforms: publicPlatforms,
  };
}
