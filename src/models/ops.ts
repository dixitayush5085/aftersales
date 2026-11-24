import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PLATFORMS } from "@/types";

const AssignmentSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, required: true, enum: ["primary", "platform"] },
    platform: { type: String, enum: PLATFORMS, default: null },
  },
  { timestamps: true },
);

const InventoryLotSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    purchasedAt: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: "" },
    proofUrl: { type: String, default: "" },
    amount: { type: Number, default: 0, min: 0 },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

const InventoryItemSchema = new Schema(
  {
    lotId: { type: Schema.Types.ObjectId, ref: "InventoryLot", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    remaining: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

const SaleLogSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    units: { type: Number, default: 0, min: 0 },
    itemId: { type: Schema.Types.ObjectId, ref: "InventoryItem", default: null },
    /** Optional SKU or lot reference. Recorded only; stock is not deducted. */
    sku: { type: String, default: "" },
    proofUrl: { type: String, default: "" },
    soldAt: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

SaleLogSchema.index({ userId: 1, soldAt: -1 });

const TargetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

TargetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const WebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
    },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });

export type AssignmentDoc = InferSchemaType<typeof AssignmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Assignment: Model<AssignmentDoc> =
  (mongoose.models.Assignment as Model<AssignmentDoc>) ||
  mongoose.model<AssignmentDoc>("Assignment", AssignmentSchema);

export const InventoryLot =
  mongoose.models.InventoryLot ||
  mongoose.model("InventoryLot", InventoryLotSchema);

export const InventoryItem =
  mongoose.models.InventoryItem ||
  mongoose.model("InventoryItem", InventoryItemSchema);

export const SaleLog =
  mongoose.models.SaleLog || mongoose.model("SaleLog", SaleLogSchema);

export const Target =
  mongoose.models.Target || mongoose.model("Target", TargetSchema);

export const WebhookEvent =
  mongoose.models.WebhookEvent ||
  mongoose.model("WebhookEvent", WebhookEventSchema);

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
