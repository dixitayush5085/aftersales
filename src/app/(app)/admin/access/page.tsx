import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageAccess } from "@/lib/rbac";
import { getAccessMatrix } from "@/lib/access";
import { getColumnCatalog } from "@/lib/columns";
import { AccessMatrix } from "@/components/access-matrix";
import { ColumnsMatrix } from "@/components/columns-matrix";

export default async function AccessPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (!(await canManageAccess(session.user.role))) redirect("/");

  const [matrix, columns] = await Promise.all([getAccessMatrix(), getColumnCatalog()]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
        <p className="text-sm text-muted-foreground">
          Turn actions and client columns on or off for Super Manager, Manager, and Account
          Manager. Admin always configures this screen and does not assign clients.
        </p>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Actions</h2>
        <AccessMatrix matrix={matrix} />
      </div>
      <ColumnsMatrix columns={columns} />
    </div>
  );
}
