import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { assertCanAccessClient } from "@/lib/rbac";
import { getClientShell } from "@/lib/queries/clients";
import { ClientHeader } from "@/components/client-header";
import { ClientTabs } from "@/components/client-tabs";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  try {
    await assertCanAccessClient(session.user, id);
  } catch {
    notFound();
  }
  const shell = await getClientShell(id);
  if (!shell) notFound();

  const origin = process.env.APP_URL || process.env.AUTH_URL || "";
  const trackingUrl = `${origin}/t/${shell.trackingToken}`;

  return (
    <div className="space-y-6">
      <ClientHeader shell={shell} trackingUrl={trackingUrl} />
      <ClientTabs clientId={id} />
      {children}
    </div>
  );
}
