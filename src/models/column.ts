import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ClientColumnSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    kind: { type: String, required: true, enum: ["builtin", "custom"] },
    type: { type: String, required: true },
    sortOrder: { type: Number, required: true, default: 0 },
    visible: {
      ADMIN: { type: Boolean, default: true },
      SUPER_MANAGER: { type: Boolean, default: false },
      MANAGER: { type: Boolean, default: false },
      TEAM_MEMBER: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

export type ClientColumnDoc = InferSchemaType<typeof ClientColumnSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ClientColumnModel: Model<ClientColumnDoc> =
  (mongoose.models.ClientColumn as Model<ClientColumnDoc>) ||
  mongoose.model<ClientColumnDoc>("ClientColumn", ClientColumnSchema);
