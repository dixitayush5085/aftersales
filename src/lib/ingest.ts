import crypto from "crypto";
import { Client } from "@/models/client";
import { Milestone, MilestoneTemplate, PlatformAccount } from "@/models/platform";
import { WebhookEvent } from "@/models/ops";
import { PLATFORMS } from "@/types";
import { dbConnect } from "@/lib/db";
import { platformsForPlan } from "@/lib/plan-platforms";

const DEFAULT_MILESTONES = [
  { key: "account", label: "Account creation", sortOrder: 0 },
  { key: "listing", label: "Marketplace listing", sortOrder: 1 },
  { key: "catalog", label: "Catalog / SEO", sortOrder: 2 },
  { key: "notes", label: "Notes / blockers", sortOrder: 3 },
];

export type LmsWebhookPayload = {
  event: "client.converted" | "client.rolled_back";
  occurredAt?: string;
  eventId?: string;
  lmsLeadId: string;
  lmsSaleId?: string | null;
  name?: string;
  mobile?: string;
  email?: string;
  state?: string;
  city?: string;
  address?: string;
  pincode?: string;
  gstStatus?: string;
  saleAmount?: number;
  salesAmount?: number;
  saleDate?: string;
  salesExecutiveId?: string;
  influencerId?: string;
  sourceCode?: string;
  planType?: string;
};

export function verifyLmsSignature(rawBody: string, header: string | null) {
  const secret = process.env.LMS_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const provided = header.replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function ingestLmsEvent(payload: LmsWebhookPayload) {
  await dbConnect();

  const eventId =
    payload.eventId ||
    `${payload.event}:${payload.lmsLeadId}:${payload.occurredAt ?? "na"}`;

  try {
    await WebhookEvent.create({
      eventId,
      event: payload.event,
      payload,
      status: "processing",
    });
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code === 11000) {
      return { ok: true, duplicate: true };
    }
    throw error;
  }

  try {
    if (payload.event === "client.converted") {
      await upsertConvertedClient(payload);
    } else if (payload.event === "client.rolled_back") {
      await Client.updateOne(
        { lmsLeadId: payload.lmsLeadId },
        { $set: { lifecycleStatus: "rolled_back" } },
      );
    } else {
      throw new Error("Unknown event");
    }

    await WebhookEvent.updateOne({ eventId }, { $set: { status: "processed" } });
    return { ok: true };
  } catch (error) {
    await WebhookEvent.updateOne(
      { eventId },
      {
        $set: {
          status: "failed",
          error: error instanceof Error ? error.message : "ingest failed",
        },
      },
    );
    throw error;
  }
}

export async function upsertConvertedClient(payload: LmsWebhookPayload) {
  await dbConnect();

  const amount = Number(payload.saleAmount ?? payload.salesAmount ?? 0) || 0;
  const gstStatus = ["YES", "NO", "APPLIED", "APPLIED_THROUGH_US"].includes(
    String(payload.gstStatus),
  )
    ? payload.gstStatus
    : "NO";

  const existing = await Client.findOne({ lmsLeadId: payload.lmsLeadId });
  const trackingToken = existing?.trackingToken ?? crypto.randomBytes(24).toString("base64url");

  const snapshot = {
    lmsSaleId: payload.lmsSaleId ?? existing?.lmsSaleId ?? null,
    name: payload.name ?? existing?.name ?? "",
    mobile: payload.mobile ?? existing?.mobile ?? "",
    email: payload.email ?? existing?.email ?? "",
    state: payload.state ?? existing?.state ?? "",
    city: payload.city ?? existing?.city ?? "",
    address: payload.address ?? existing?.address ?? "",
    pincode: payload.pincode ?? existing?.pincode ?? "",
    gstStatus,
    salesAmount: amount,
    saleDate: payload.saleDate ? new Date(payload.saleDate) : existing?.saleDate ?? null,
    salesExecutiveId: payload.salesExecutiveId ?? existing?.salesExecutiveId ?? "",
    influencerId: payload.influencerId ?? existing?.influencerId ?? "",
    sourceCode: payload.sourceCode ?? existing?.sourceCode ?? "",
    planType: payload.planType ?? existing?.planType ?? "",
    lifecycleStatus: "active" as const,
    trackingToken,
  };

  const client = await Client.findOneAndUpdate(
    { lmsLeadId: payload.lmsLeadId },
    {
      $set: snapshot,
      $setOnInsert: {
        lmsLeadId: payload.lmsLeadId,
        primaryAmId: null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!client) return;

  const included = new Set(platformsForPlan(client.planType));
  const templates = await MilestoneTemplate.find().sort({ sortOrder: 1 }).lean();
  for (const platform of PLATFORMS) {
    const status = included.has(platform) ? "open" : "na";
    const account = await PlatformAccount.findOneAndUpdate(
      { clientId: client._id, platform },
      {
        $setOnInsert: { clientId: client._id, platform, status },
      },
      { upsert: true, returnDocument: "after" },
    );
    const existingMs = await Milestone.countDocuments({ platformAccountId: account._id });
    if (existingMs > 0) continue;

    const forPlatform = templates.filter((t) => t.platform === platform);
    const rows = forPlatform.length
      ? forPlatform
      : DEFAULT_MILESTONES.map((m) => ({ ...m, platform }));
    await Milestone.insertMany(
      rows.map((m) => ({
        platformAccountId: account._id,
        key: m.key,
        label: m.label,
        sortOrder: m.sortOrder,
        status: "pending",
      })),
    );
  }
}
