import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { getClientOverview } from "@/lib/queries/clients";
import { ClientOverview } from "@/components/client-workspace";

export default async function ClientOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  const data = await getClientOverview(id, session.user.role);
  if (!data) notFound();
  return <ClientOverview data={data} />;
}
