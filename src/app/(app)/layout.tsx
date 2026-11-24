import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { permissionsFor } from "@/lib/access";
import { mergeRoleAccess } from "@/lib/access-policy";
import { AppShell } from "@/components/app-shell";
import { normalizeRole } from "@/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = normalizeRole(session.user.role);

  let permissions = mergeRoleAccess(role);
  try {
    permissions = await permissionsFor(role);
  } catch {
    // Keep role defaults if Access matrix cannot be read.
  }

  return (
    <AppShell user={{ ...session.user, role }} permissions={permissions}>
      {children}
    </AppShell>
  );
}
