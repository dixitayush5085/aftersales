import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MILESTONE_STATUSES, PLATFORMS, PLATFORM_STATUSES } from "@/types";

const PlatformAccountSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    platform: { type: String, required: true, enum: PLATFORMS },
    status: { type: String, required: true, enum: PLATFORM_STATUSES, default: "open" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sellerLogin: { type: String, default: "" },
    credentialEnc: { type: String, default: "" },
    credentialHint: { type: String, default: "" },
    credentialUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PlatformAccountSchema.index({ clientId: 1, platform: 1 }, { unique: true });
PlatformAccountSchema.index({ platform: 1, status: 1 });

const MilestoneSchema = new Schema(
  {
    platformAccountId: {
      type: Schema.Types.ObjectId,
      ref: "PlatformAccount",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    label: { type: String, required: true },
    status: { type: String, required: true, enum: MILESTONE_STATUSES, default: "pending" },
    notes: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const MilestoneTemplateSchema = new Schema(
  {
    platform: { type: String, required: true, enum: PLATFORMS },
    key: { type: String, required: true },
    label: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

MilestoneTemplateSchema.index({ platform: 1, key: 1 }, { unique: true });

export type PlatformAccountDoc = InferSchemaType<typeof PlatformAccountSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type MilestoneDoc = InferSchemaType<typeof MilestoneSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type MilestoneTemplateDoc = InferSchemaType<typeof MilestoneTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PlatformAccount: Model<PlatformAccountDoc> =
  (mongoose.models.PlatformAccount as Model<PlatformAccountDoc>) ||
  mongoose.model<PlatformAccountDoc>("PlatformAccount", PlatformAccountSchema);

export const Milestone: Model<MilestoneDoc> =
  (mongoose.models.Milestone as Model<MilestoneDoc>) ||
  mongoose.model<MilestoneDoc>("Milestone", MilestoneSchema);

export const MilestoneTemplate: Model<MilestoneTemplateDoc> =
  (mongoose.models.MilestoneTemplate as Model<MilestoneTemplateDoc>) ||
  mongoose.model<MilestoneTemplateDoc>("MilestoneTemplate", MilestoneTemplateSchema);
