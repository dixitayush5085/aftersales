"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/db";
import { logClientActivity } from "@/lib/activity";
import { platformsForPlan } from "@/lib/plan-platforms";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/secret-box";
import { assertCanAccessClient, assignableTeamMemberIds, canAssignClients, requireUser } from "@/lib/rbac";
import { Client } from "@/models/client";
import { Assignment, SaleLog, Target } from "@/models/ops";
import { Milestone, PlatformAccount } from "@/models/platform";
import { User } from "@/models/user";
import {
  GST_STATUSES,
  PLATFORM_LABELS,
  PLATFORMS,
  type MilestoneStatus,
  type Platform,
  type PlatformStatus,
} from "@/types";

export async function assignPrimaryAm(clientId: string, amId: string) {
  const user = await requireUser();
  if (!(await canAssignClients(user.role))) throw new Error("Forbidden");
  await dbConnect();

  const allowed = await assignableTeamMemberIds(user);
  if (allowed !== "all" && !allowed.includes(String(amId))) {
    throw new Error("You can only assign a team member on your team");
  }

  const am = await User.findOne({
    _id: amId,
    role: "TEAM_MEMBER",
    isActive: true,
  });
  if (!am) throw new Error("Team member not found");

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
  refreshClient(clientId);
}

export async function updateClientExtras(
  clientId: string,
  data: {
    companyName?: string;
    gstin?: string;
    planType?: string;
    gstStatus?: string;
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
    ...(data.gstStatus && (GST_STATUSES as readonly string[]).includes(data.gstStatus)
      ? { gstStatus: data.gstStatus }
      : {}),
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
  let profileMessage = "Updated business profile";
  if (data.planType !== undefined) {
    const included = new Set(platformsForPlan(data.planType));
    const skipped: string[] = [];
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
      if (!included.has(platform)) skipped.push(PLATFORM_LABELS[platform]);
      // Status only. Milestones, seller login, and encrypted credentials stay as they are.
      await PlatformAccount.updateOne(
        { clientId: new Types.ObjectId(clientId), platform },
        {
          $set: { status: nextStatus },
          $setOnInsert: { clientId: new Types.ObjectId(clientId), platform },
        },
        { upsert: true },
      );
    }
    if (skipped.length) {
      profileMessage = `Updated business profile. Marked ${skipped.join(", ")} as not needed`;
    }
  }
  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "profile",
    message: profileMessage,
  });
  refreshClient(clientId);
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
  refreshClient(String(account.clientId));
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
  refreshClient(String(account.clientId));
}

export async function listAssignableAms() {
  const user = await requireUser();
  if (!(await canAssignClients(user.role))) return [];
  await dbConnect();

  const allowed = await assignableTeamMemberIds(user);
  const filter: Record<string, unknown> = { role: "TEAM_MEMBER", isActive: true };
  if (allowed !== "all") {
    filter._id = { $in: allowed.map((id) => new Types.ObjectId(id)) };
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
  refreshClient(String(account.clientId));
}

export async function saveCatalogNotes(accountId: string, notes: string) {
  const user = await requireUser();
  await dbConnect();
  const account = await PlatformAccount.findById(accountId);
  if (!account) throw new Error("Not found");
  await assertCanAccessClient(user, String(account.clientId));
  account.catalogNotes = notes;
  await account.save();
  await logClientActivity({
    clientId: String(account.clientId),
    actorId: user.id,
    kind: "note",
    message: `Updated ${PLATFORM_LABELS[account.platform as Platform]} catalog / SEO notes`,
  });
  refreshClient(String(account.clientId));
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

/**
 * Inventory write hook. Stock lots, remaining quantity, and payment-proof orders
 * stay in the schema for the next inventory pass, and this action does not create them.
 */
export async function addStockOrder(
  clientId: string,
  _data: {
    notes: string;
    proofUrl: string;
    items: { name: string; quantity: number; unitPrice: number }[];
  },
) {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  throw new Error("Inventory recording is not available yet");
}

export async function logClientSale(
  clientId: string,
  data: { amount: number; units: number; sku?: string; notes: string; proofUrl?: string },
) {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  if (data.amount <= 0) throw new Error("Sale amount is required");
  await dbConnect();
  const sku = (data.sku || "").trim();
  const proofUrl = saleProofUrl(clientId, data.proofUrl);
  await SaleLog.create({
    clientId,
    userId: user.id,
    amount: data.amount,
    units: Math.max(0, data.units || 0),
    sku,
    notes: data.notes.trim(),
    proofUrl,
    soldAt: new Date(),
  });
  await logClientActivity({
    clientId,
    actorId: user.id,
    kind: "sale",
    message: sku
      ? `Logged sale ${formatQuiet(data.amount)} · SKU ${sku}`
      : `Logged sale ${formatQuiet(data.amount)}`,
  });
  refreshClient(clientId);
  revalidatePath("/");
}

export async function addClientNote(clientId: string, message: string, kind: "note" | "health" | "ads") {
  const user = await requireUser();
  await assertCanAccessClient(user, clientId);
  const text = message.trim();
  if (!text) throw new Error("Write a note");
  await logClientActivity({ clientId, actorId: user.id, kind, message: text });
  refreshClient(clientId);
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

function refreshClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`, "layout");
}

function saleProofUrl(clientId: string, proofUrl: string | undefined) {
  const url = (proofUrl || "").trim();
  if (!url) return "";
  const prefix = `/api/uploads/${clientId}/`;
  const name = url.startsWith(prefix) ? url.slice(prefix.length) : "";
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(name)) {
    throw new Error("Proof file is not for this client");
  }
  return url;
}
