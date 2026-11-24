import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { ClientInventory } from "@/components/client-inventory";

export default async function ClientInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  return <ClientInventory />;
}
