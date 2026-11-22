import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const GroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    smUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

export type GroupDoc = InferSchemaType<typeof GroupSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Group: Model<GroupDoc> =
  (mongoose.models.Group as Model<GroupDoc>) ||
  mongoose.model<GroupDoc>("Group", GroupSchema);
