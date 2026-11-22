import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";

const NAME = /^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/;
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string; filename: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { clientId, filename } = await params;
  if (!NAME.test(filename)) return new Response("Not found", { status: 404 });

  try {
    await assertCanAccessClient(session.user, clientId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), "uploads", "proofs", clientId, filename));
    const ext = filename.split(".").pop() as keyof typeof MIME;
    return new Response(file, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
