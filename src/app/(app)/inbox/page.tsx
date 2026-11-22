import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { auth } from "@/lib/auth";
import { columnsForRole } from "@/lib/columns";
import { canAssignClients } from "@/lib/rbac";
import { listAssignableAms } from "@/lib/actions/clients";
import { listClients } from "@/lib/queries/clients";
import { ClientsTable } from "@/components/clients-table";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if (!(await canAssignClients(session.user.role))) redirect("/");

  const params = await searchParams;
  const page = Number(params.page || 1);
  const [{ items, pageCount, total }, ams, columns] = await Promise.all([
    listClients({ user: session.user, page, unassignedOnly: true }),
    listAssignableAms(),
    columnsForRole(session.user.role),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unassigned pool</h1>
        <p className="text-sm text-muted-foreground">
          {total} converted {total === 1 ? "client" : "clients"} waiting for an account manager.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox is clear"
          description="New conversions from LMS will show up here automatically."
        />
      ) : (
        <>
          <ClientsTable rows={items} ams={ams} columns={columns} />
          <Pagination page={page} pageCount={pageCount} hrefFor={(p) => `/inbox?page=${p}`} />
        </>
      )}
    </div>
  );
}
