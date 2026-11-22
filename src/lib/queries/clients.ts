import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { canSeeColumn, columnsForRole } from "@/lib/columns";
import { canAssignClients, canSeeRolledBack, clientMatchFor, type SessionUser } from "@/lib/rbac";
import { ClientActivity } from "@/models/activity";
import { Client } from "@/models/client";
import { InventoryItem, InventoryLot, SaleLog, Target } from "@/models/ops";
import { User } from "@/models/user";
import { Milestone, PlatformAccount } from "@/models/platform";
import { idString } from "@/lib/utils";
import type { ClientColumn, Platform, PlatformStatus, Role } from "@/types";

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
    primaryAmName: r.primaryAmId ? amMap.get(String(r.primaryAmId)) || "" : "",
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

  const visible = await Client.find({ ...match, lifecycleStatus: "active" } as never)
    .select("_id name companyName")
    .limit(400)
    .lean();
  const visibleMap = new Map(visible.map((c) => [String(c._id), c]));
  const accounts = await PlatformAccount.find({
    clientId: { $in: visible.map((c) => c._id) },
  })
    .select("clientId platform")
    .lean();
  const accountMap = new Map(accounts.map((a) => [String(a._id), a]));
  const blocked = await Milestone.find({
    platformAccountId: { $in: accounts.map((a) => a._id) },
    status: "blocked",
  })
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [target, achieved] = await Promise.all([
    Target.findOne({
      userId: new Types.ObjectId(user.id),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }).lean(),
    SaleLog.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(user.id),
          soldAt: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    counts: { active, unassigned: unassignedCount, rolledBack },
    target: {
      amount: Number(target?.amount ?? 0),
      achieved: Number(achieved[0]?.total ?? 0),
      monthLabel: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
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

export async function getClientWorkspace(clientId: string, role?: Role) {
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
      primaryAmName: am?.name || "",
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
    inventory: await loadInventory(client._id),
    activity: await loadActivity(client._id),
  };
}

async function loadInventory(clientId: Types.ObjectId | string) {
  const lots = await InventoryLot.find({ clientId }).sort({ createdAt: -1 }).limit(20).lean();
  const items = await InventoryItem.find({ clientId }).lean();
  const byLot = new Map<string, typeof items>();
  for (const item of items) {
    const key = String(item.lotId);
    const list = byLot.get(key) ?? [];
    list.push(item);
    byLot.set(key, list);
  }
  return {
    lots: lots.map((lot) => ({
      id: idString(lot._id),
      notes: lot.notes || "",
      proofUrl: lot.proofUrl || "",
      amount: lot.amount ?? 0,
      purchasedAt: lot.purchasedAt ? new Date(lot.purchasedAt).toISOString() : "",
      items: (byLot.get(String(lot._id)) ?? []).map((item) => ({
        id: idString(item._id),
        name: item.name,
        quantity: item.quantity,
        remaining: item.remaining,
      })),
    })),
    openItems: items
      .filter((item) => item.remaining > 0)
      .map((item) => ({
        id: idString(item._id),
        name: item.name,
        remaining: item.remaining,
      })),
  };
}

async function loadActivity(clientId: Types.ObjectId | string) {
  const rows = await ClientActivity.find({ clientId }).sort({ createdAt: -1 }).limit(40).lean();
  const actors = await User.find({
    _id: { $in: rows.map((row) => row.actorId).filter(Boolean) },
  })
    .select("name")
    .lean();
  const names = new Map(actors.map((a) => [String(a._id), a.name]));
  return rows.map((row) => ({
    id: idString(row._id),
    kind: row.kind,
    message: row.message,
    actorName: names.get(String(row.actorId)) || "Someone",
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
  }));
}

export async function getPublicProgress(token: string) {
  await dbConnect();
  const client = await Client.findOne({
    trackingToken: token,
    lifecycleStatus: "active",
  }).lean();
  if (!client) return null;
  const data = await getClientWorkspace(String(client._id));
  if (!data) return null;
  return {
    name: data.client.name || data.client.companyName || "Your account",
    companyName: data.client.companyName,
    platforms: data.platforms.map((p) => ({
      id: p.id,
      platform: p.platform,
      status: p.status,
      milestones: p.milestones.map((m) => ({
        id: m.id,
        label: m.label,
        status: m.status,
        notes: "",
      })),
    })),
  };
}
