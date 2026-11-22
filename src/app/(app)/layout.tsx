import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { permissionsFor } from "@/lib/access";
import { mergeRoleAccess } from "@/lib/access-policy";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let permissions = mergeRoleAccess(session.user.role);
  try {
    permissions = await permissionsFor(session.user.role);
  } catch {
    // Keep role defaults if Access matrix cannot be read.
  }

  return (
    <AppShell user={session.user} permissions={permissions}>
      {children}
    </AppShell>
  );
}
