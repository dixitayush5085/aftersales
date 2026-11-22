import { Suspense } from "react";
import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { columnsForRole } from "@/lib/columns";
import { canAssignClients } from "@/lib/rbac";
import { listAssignableAms } from "@/lib/actions/clients";
import { listClients } from "@/lib/queries/clients";
import { ClientsTable } from "@/components/clients-table";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await connection();
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const page = Number(params.page || 1);
  const q = params.q || "";
  const canAssign = await canAssignClients(session.user.role);
  const [{ items, pageCount, total }, ams, columns] = await Promise.all([
    listClients({ user: session.user, page, q }),
    canAssign ? listAssignableAms() : Promise.resolve([]),
    columnsForRole(session.user.role),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{total} in your view</p>
        </div>
        <Suspense fallback={<div className="h-10 w-80 rounded-lg bg-muted" />}>
          <SearchField defaultValue={q} placeholder="Search name, mobile, company" />
        </Suspense>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q ? "No matching clients" : "No clients yet"}
          description={
            q
              ? "Try a different name, mobile, or company."
              : "When LMS converts a lead, they land in Unassigned, then here after assignment."
          }
          action={
            !q && canAssign ? (
              <Button asChild variant="outline">
                <Link href="/inbox">Open unassigned pool</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ClientsTable
            key={`${q}-${page}`}
            rows={items}
            ams={canAssign ? ams : undefined}
            columns={columns}
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            hrefFor={(p) => `/clients?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          />
        </>
      )}
    </div>
  );
}
