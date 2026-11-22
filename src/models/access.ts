import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/types";

const RoleAccessSchema = new Schema(
  {
    role: { type: String, required: true, unique: true, enum: ROLES },
    permissions: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type RoleAccessDoc = InferSchemaType<typeof RoleAccessSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RoleAccess: Model<RoleAccessDoc> =
  (mongoose.models.RoleAccess as Model<RoleAccessDoc>) ||
  mongoose.model<RoleAccessDoc>("RoleAccess", RoleAccessSchema);
