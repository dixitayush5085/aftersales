import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const clientId = String(form.get("clientId") || "");
  const file = form.get("file");
  if (!clientId || !(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    await assertCanAccessClient(session.user, clientId);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File too large (8 MB max)" }, { status: 400 });
  }
  const ext = TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "Use JPG, PNG, WebP, or PDF" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "uploads", "proofs", clientId);
  await mkdir(dir, { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/api/uploads/${clientId}/${name}` });
}
