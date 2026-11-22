"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { logClientActivity } from "@/lib/activity";
import { platformsForPlan } from "@/lib/plan-platforms";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/secret-box";
import { assertCanAccessClient, canAssignClients, requireUser } from "@/lib/rbac";
import { Client } from "@/models/client";
import { Assignment, InventoryItem, InventoryLot, SaleLog, Target } from "@/models/ops";
import { Milestone, PlatformAccount } from "@/models/platform";
import { User } from "@/models/user";
import { PLATFORMS, type MilestoneStatus, type PlatformStatus } from "@/types";

export async function assignPrimaryAm(clientId: string, amId: string) {
  const user = await requireUser();
  if (!(await canAssignClients(user.role))) throw new Error("Forbidden");
  await dbConnect();

  const am = await User.findOne({
    _id: amId,
    role: "TEAM_MEMBER",
    isActive: true,
  });
  if (!am) throw new Error("Account manager not found");

  const client = await Client.findById(clientId);
  if (!client || client.lifecycleStatus !== "active") throw new Error("Client not found");

  client.primaryAmId = new Types.ObjectId(amId);
  await client.save();

  await Assignment.findOneAndUpdate(
    { clientId: client._id, kind: "primary" },
    { $set: { userId: am._id, kind: "primary" } },
    { upsert: true },
  );

  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "status",
    message: `Assigned to ${am.name}`,
    meta: { amId },
  });

  revalidatePath("/inbox");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function updateClientExtras(
  clientId: string,
  data: {
    companyName?: string;
    gstin?: string;
    planType?: string;
    notes?: string;
    address?: string;
    state?: string;
    city?: string;
    pincode?: string;
    customFields?: Record<string, string>;
  },
) {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  await dbConnect();
  const set: Record<string, unknown> = {
    ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
    ...(data.gstin !== undefined ? { gstin: data.gstin } : {}),
    ...(data.planType !== undefined ? { planType: data.planType } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.state !== undefined ? { state: data.state } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
  };
  if (data.customFields) {
    const { columnsForRole } = await import("@/lib/columns");
    const allowed = new Set(
      (await columnsForRole(user.role)).filter((col) => col.kind === "custom").map((col) => col.key),
    );
    for (const [key, value] of Object.entries(data.customFields)) {
      if (allowed.has(key)) set[`customFields.${key}`] = value;
    }
  }
  await Client.updateOne({ _id: clientId }, { $set: set });
  if (data.planType !== undefined) {
    const included = new Set(platformsForPlan(data.planType));
    for (const platform of PLATFORMS) {
      const existing = await PlatformAccount.findOne({
        clientId: new Types.ObjectId(clientId),
        platform,
      });
      const nextStatus = included.has(platform)
        ? existing && existing.status !== "na"
          ? existing.status
          : "open"
        : "na";
      await PlatformAccount.updateOne(
        { clientId: new Types.ObjectId(clientId), platform },
        {
          $set: { status: nextStatus },
          $setOnInsert: { clientId: new Types.ObjectId(clientId), platform },
        },
        { upsert: true },
      );
    }
  }
  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "profile",
    message: "Updated business profile",
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function updatePlatformStatus(accountId: string, status: PlatformStatus) {
  const user = await requireUser();
  await dbConnect();
  const account = await PlatformAccount.findById(accountId);
  if (!account) throw new Error("Not found");
  await assertCanAccessClient(user, String(account.clientId));
  account.status = status;
  await account.save();
  await logClientActivity({
    clientId: String(account.clientId),
    actorId: user.id,
    kind: "status",
    message: `Set ${account.platform} to ${status}`,
  });
  revalidatePath(`/clients/${String(account.clientId)}`);
}

export async function updateMilestone(
  milestoneId: string,
  data: { status?: MilestoneStatus; notes?: string },
) {
  const user = await requireUser();
  await dbConnect();
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) throw new Error("Not found");
  const account = await PlatformAccount.findById(milestone.platformAccountId);
  if (!account) throw new Error("Not found");
  await assertCanAccessClient(user, String(account.clientId));
  if (data.status) milestone.status = data.status;
  if (data.notes !== undefined) milestone.notes = data.notes;
  await milestone.save();
  await logClientActivity({
    clientId: String(account.clientId),
    actorId: user.id,
    kind: data.notes !== undefined && !data.status ? "note" : "status",
    message: data.status
      ? `${milestone.label}: ${data.status}`
      : `${milestone.label} notes updated`,
  });
  revalidatePath(`/clients/${String(account.clientId)}`);
}

export async function listAssignableAms() {
  const user = await requireUser();
  if (!(await canAssignClients(user.role))) return [];
  await dbConnect();

  const filter: Record<string, unknown> = { role: "TEAM_MEMBER", isActive: true };
  if (user.role === "MANAGER") {
    filter.managerId = user.id;
  }
  if (user.role === "SUPER_MANAGER") {
    const { Group } = await import("@/models/group");
    const groups = await Group.find({ smUserId: user.id }).select("_id").lean();
    const managers = await User.find({
      groupId: { $in: groups.map((g) => g._id) },
      role: "MANAGER",
    })
      .select("_id")
      .lean();
    filter.managerId = { $in: managers.map((m) => m._id) };
  }

  const ams = await User.find(filter).select("name email").sort({ name: 1 }).lean();
  return ams.map((a) => ({ id: String(a._id), name: a.name, email: a.email }));
}

export async function saveSellerCredentials(
  accountId: string,
  data: { sellerLogin: string; password?: string },
) {
  const user = await requireUser();
  await dbConnect();
  const account = await PlatformAccount.findById(accountId);
  if (!account) throw new Error("Not found");
  await assertCanAccessClient(user, String(account.clientId));
  account.sellerLogin = data.sellerLogin.trim();
  const password = data.password?.trim();
  if (password) {
    account.credentialEnc = encryptSecret(password);
    account.credentialHint = secretHint(password);
    account.credentialUpdatedAt = new Date();
  }
  await account.save();
  await logClientActivity({
    clientId: String(account.clientId),
    actorId: user.id,
    kind: "credential",
    message: `Updated ${account.platform} seller login`,
  });
  revalidatePath(`/clients/${String(account.clientId)}`);
}

export async function revealSellerPassword(accountId: string) {
  const user = await requireUser();
  await dbConnect();
  const account = await PlatformAccount.findById(accountId);
  if (!account) throw new Error("Not found");
  await assertCanAccessClient(user, String(account.clientId));
  if (!account.credentialEnc) throw new Error("No password saved");
  return decryptSecret(account.credentialEnc);
}

export async function addStockOrder(
  clientId: string,
  data: {
    notes: string;
    proofUrl: string;
    items: { name: string; quantity: number; unitPrice: number }[];
  },
) {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  const items = data.items.filter((item) => item.name.trim() && item.quantity > 0);
  if (!items.length) throw new Error("Add at least one item");
  if (!data.proofUrl.trim()) throw new Error("Payment proof is required");

  await dbConnect();
  const amount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lot = await InventoryLot.create({
    clientId,
    notes: data.notes.trim(),
    proofUrl: data.proofUrl.trim(),
    amount,
    createdById: user.id,
    purchasedAt: new Date(),
  });
  await InventoryItem.insertMany(
    items.map((item) => ({
      lotId: lot._id,
      clientId,
      name: item.name.trim(),
      quantity: item.quantity,
      remaining: item.quantity,
    })),
  );
  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "stock",
    message: `Stock order ${formatQuiet(amount)} · ${items.length} item(s)`,
    meta: { lotId: String(lot._id), amount },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

export async function logClientSale(
  clientId: string,
  data: { amount: number; units: number; itemId?: string; notes: string },
) {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  if (data.amount <= 0) throw new Error("Sale amount is required");
  await dbConnect();
  if (data.itemId) {
    const item = await InventoryItem.findOne({ _id: data.itemId, clientId });
    if (!item) throw new Error("Inventory item not found");
    const units = Math.max(0, data.units);
    if (item.remaining < units) throw new Error("Not enough remaining stock");
    item.remaining -= units;
    await item.save();
  }
  await SaleLog.create({
    clientId,
    userId: user.id,
    amount: data.amount,
    units: data.units,
    itemId: data.itemId || null,
    notes: data.notes.trim(),
    soldAt: new Date(),
  });
  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "sale",
    message: `Logged sale ${formatQuiet(data.amount)}`,
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

export async function addClientNote(clientId: string, message: string, kind: "note" | "health" | "ads") {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  const text = message.trim();
  if (!text) throw new Error("Write a note");
  await logClientActivity({ clientId, actorId: user.id, kind, message: text });
  revalidatePath(`/clients/${clientId}`);
}

export async function setMyMonthlyTarget(amount: number) {
  const user = await requireUser();
  if (amount < 0) throw new Error("Target cannot be negative");
  const now = new Date();
  await dbConnect();
  await Target.findOneAndUpdate(
    { userId: new Types.ObjectId(user.id), year: now.getFullYear(), month: now.getMonth() + 1 },
    { $set: { amount } },
    { upsert: true },
  );
  revalidatePath("/");
}

function formatQuiet(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}
