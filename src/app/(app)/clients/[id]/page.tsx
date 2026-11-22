import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { getClientWorkspace } from "@/lib/queries/clients";
import { ClientWorkspace } from "@/components/client-workspace";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  const data = await getClientWorkspace(id, session.user.role);
  if (!data) notFound();

  const origin = process.env.APP_URL || process.env.AUTH_URL || "";
  const trackingUrl = `${origin}/t/${data.client.trackingToken}`;

  return <ClientWorkspace data={data} trackingUrl={trackingUrl} />;
}
