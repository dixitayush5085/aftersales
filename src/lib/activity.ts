import { Types } from "mongoose";
import { ClientActivity } from "@/models/activity";
import { AuditLog } from "@/models/ops";
import type { ActivityKind } from "@/types";

export async function logClientActivity(input: {
  clientId: string;
  actorId: string;
  kind: ActivityKind;
  message: string;
  meta?: Record<string, unknown>;
}) {
  await ClientActivity.create({
    clientId: new Types.ObjectId(input.clientId),
    actorId: new Types.ObjectId(input.actorId),
    kind: input.kind,
    message: input.message,
    meta: input.meta ?? {},
  });
  await AuditLog.create({
    actorId: input.actorId,
    action: `client.${input.kind}`,
    entityType: "client",
    entityId: input.clientId,
    meta: { message: input.message, ...(input.meta ?? {}) },
  });
}
