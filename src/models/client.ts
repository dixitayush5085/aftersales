import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { GST_STATUSES, LIFECYCLE_STATUSES } from "@/types";

const ClientSchema = new Schema(
  {
    lmsLeadId: { type: String, required: true, unique: true, index: true },
    lmsSaleId: { type: String, default: null },
    name: { type: String, default: "" },
    mobile: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    pincode: { type: String, default: "" },
    gstStatus: { type: String, enum: GST_STATUSES, default: "NO" },
    salesAmount: { type: Number, default: 0 },
    saleDate: { type: Date, default: null },
    salesExecutiveId: { type: String, default: "" },
    influencerId: { type: String, default: "" },
    sourceCode: { type: String, default: "" },
    companyName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    planType: { type: String, default: "" },
    lifecycleStatus: {
      type: String,
      enum: LIFECYCLE_STATUSES,
      default: "active",
      index: true,
    },
    trackingToken: { type: String, required: true, unique: true, index: true },
    primaryAmId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    notes: { type: String, default: "" },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ClientSchema.index({ lifecycleStatus: 1, primaryAmId: 1 });

export type ClientDoc = InferSchemaType<typeof ClientSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Client: Model<ClientDoc> =
  (mongoose.models.Client as Model<ClientDoc>) ||
  mongoose.model<ClientDoc>("Client", ClientSchema);
