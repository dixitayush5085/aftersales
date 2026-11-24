"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logClientSale } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatInr } from "@/lib/format";
import { ROLE_LABELS } from "@/types";
import type { listClientSales } from "@/lib/queries/clients";

type Sales = Awaited<ReturnType<typeof listClientSales>>;

export function ClientSales({ clientId, sales }: { clientId: string; sales: Sales }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saleKey, setSaleKey] = useState(0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Log a sale</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            key={saleKey}
            className="space-y-3"
            action={(formData) => {
              start(async () => {
                try {
                  const file = formData.get("proof");
                  let proofUrl = "";
                  if (file instanceof File && file.size) {
                    const upload = new FormData();
                    upload.set("clientId", clientId);
                    upload.set("file", file);
                    const res = await fetch("/api/uploads", { method: "POST", body: upload });
                    const body = (await res.json()) as { url?: string; error?: string };
                    if (!res.ok || !body.url) {
                      toast.error(body.error || "Upload failed");
                      return;
                    }
                    proofUrl = body.url;
                  }
                  await logClientSale(clientId, {
                    amount: Number(formData.get("amount") || 0),
                    units: Number(formData.get("units") || 0),
                    sku: String(formData.get("sku") ?? ""),
                    notes: String(formData.get("notes") ?? ""),
                    proofUrl,
                  });
                  setSaleKey((key) => key + 1);
                  router.refresh();
                  toast.success("Sale logged");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not log sale");
                }
              });
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <Input name="amount" type="number" min={0} placeholder="Sale ₹" required />
              <Input name="units" type="number" min={0} placeholder="Units" />
            </div>
            <Input name="sku" placeholder="SKU or item reference (optional)" />
            <Input name="notes" placeholder="Optional note" />
            <div className="space-y-1">
              <Label>Payment proof</Label>
              <Input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Log sale"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">This client</CardTitle>
          <p className="text-sm text-muted-foreground">
            This month {formatInr(sales.monthTotal)}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sales.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales logged yet.</p>
          ) : (
            sales.entries.map((sale) => (
              <div key={sale.id} className="rounded-xl border bg-background/70 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium tabular-nums">{formatInr(sale.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(sale.soldAt)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    sale.units ? `${sale.units} units` : "",
                    sale.sku ? `SKU ${sale.sku}` : "",
                    `${sale.actorName} · ${ROLE_LABELS[sale.actorRole]}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {sale.notes ? <p className="text-xs">{sale.notes}</p> : null}
                {sale.proofUrl ? (
                  <a href={sale.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary">
                    View proof
                  </a>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
