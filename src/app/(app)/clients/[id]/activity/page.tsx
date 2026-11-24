import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { listClientActivity } from "@/lib/queries/clients";
import { ClientActivity } from "@/components/client-activity";

export default async function ClientActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  const activity = await listClientActivity(id);
  return <ClientActivity clientId={id} activity={activity} />;
}
