import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/types";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    role: { type: String, required: true, enum: ROLES },
    isActive: { type: Boolean, default: false },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    inviteToken: { type: String, default: null, index: true },
    inviteExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", UserSchema);
