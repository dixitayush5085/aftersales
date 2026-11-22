import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ACTIVITY_KINDS } from "@/types";

const ClientActivitySchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, required: true, enum: ACTIVITY_KINDS },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ClientActivitySchema.index({ clientId: 1, createdAt: -1 });

export type ClientActivityDoc = InferSchemaType<typeof ClientActivitySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClientActivity: Model<ClientActivityDoc> =
  (mongoose.models.ClientActivity as Model<ClientActivityDoc>) ||
  mongoose.model<ClientActivityDoc>("ClientActivity", ClientActivitySchema);
