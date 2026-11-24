import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { listClientSales } from "@/lib/queries/clients";
import { ClientSales } from "@/components/client-sales";

export default async function ClientSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  const sales = await listClientSales(id);
  return <ClientSales clientId={id} sales={sales} />;
}
