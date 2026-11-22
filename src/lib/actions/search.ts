"use server";

import { listClients } from "@/lib/queries/clients";
import { requireUser } from "@/lib/rbac";

export async function searchClientsQuick(q: string) {
  const user = await requireUser();
  if (!q.trim()) return [];
  const { items } = await listClients({ user, page: 1, q: q.trim() });
  return items.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.companyName || item.name,
    mobile: item.mobile,
  }));
}
