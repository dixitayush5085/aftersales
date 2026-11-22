"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addClientNote,
  addStockOrder,
  logClientSale,
  revealSellerPassword,
  saveSellerCredentials,
  updateClientExtras,
  updateMilestone,
  updatePlatformStatus,
} from "@/lib/actions/clients";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ProgressRail } from "@/components/progress-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/relative-time";
import { formatDate, formatInr, gstLabel } from "@/lib/format";
import {
  PLAN_OPTIONS,
  PLATFORM_LABELS,
  PLATFORM_STATUSES,
  PLATFORM_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  type ActivityKind,
  type MilestoneStatus,
  type Platform,
  type PlatformStatus,
} from "@/types";
import type { getClientWorkspace } from "@/lib/queries/clients";

type Workspace = NonNullable<Awaited<ReturnType<typeof getClientWorkspace>>>;

const platformAccent: Record<Platform, string> = {
  amazon: "bg-poster-chrome",
  flipkart: "bg-poster-cobalt",
  meesho: "bg-poster-violet",
};

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  note: "Note",
  status: "Status",
  credential: "Credentials",
  stock: "Stock",
  sale: "Sale",
  health: "Health",
  ads: "Ads",
  profile: "Profile",
};

export function ClientWorkspace({
  data,
  trackingUrl,
}: {
  data: Workspace;
  trackingUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const { client, platforms, visibleKeys, customColumns, inventory, activity } = data;
  const see = (key: string) => visibleKeys.includes(key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-poster-vermillion">
            Client
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.companyName || client.name || "Client"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[see("contact") ? client.mobile : "", see("contact") ? client.email : "", see("state") ? client.state : "", see("city") ? client.city : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge variant={client.lifecycleStatus === "active" ? "success" : "destructive"}>
          {client.lifecycleStatus === "active" ? "Active" : "Rolled back"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">LMS conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {see("planAmount") && client.salesAmount != null ? (
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-xl font-semibold tabular-nums">{formatInr(Number(client.salesAmount))}</p>
              </div>
            ) : null}
            {see("gst") ? <p>GST: {gstLabel(client.gstStatus)}</p> : null}
            {see("sourceCode") ? <p>Source: {client.sourceCode || "—"}</p> : null}
            {see("owner") ? <p>Owner: {client.primaryAmName || "Unassigned"}</p> : null}
            {see("saleDate") ? <p>Sale date: {client.saleDate ? new Date(client.saleDate).toLocaleDateString("en-IN") : "—"}</p> : null}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-2"
              action={(formData) => {
                refresh(async () => {
                  const customFields = Object.fromEntries(
                    customColumns.map((col) => [col.key, String(formData.get(col.key) ?? "")]),
                  );
                  await updateClientExtras(client.id, {
                    companyName: String(formData.get("companyName") ?? ""),
                    gstin: String(formData.get("gstin") ?? ""),
                    planType: String(formData.get("planType") ?? ""),
                    notes: String(formData.get("notes") ?? ""),
                    address: String(formData.get("address") ?? ""),
                    state: String(formData.get("state") ?? ""),
                    city: String(formData.get("city") ?? ""),
                    pincode: String(formData.get("pincode") ?? ""),
                    customFields,
                  });
                  toast.success("Details saved");
                });
              }}
            >
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input name="companyName" defaultValue={client.companyName} />
              </div>
              <div className="space-y-1">
                <Label>GST number</Label>
                <Input name="gstin" defaultValue={client.gstin} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label>Plan type</Label>
                <select
                  name="planType"
                  defaultValue={client.planType || "all"}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input name="state" defaultValue={client.state} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Billing address</Label>
                <Input name="address" defaultValue={client.address} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input name="city" defaultValue={client.city} />
              </div>
              <div className="space-y-1">
                <Label>PIN code</Label>
                <Input name="pincode" defaultValue={client.pincode} />
              </div>
              {customColumns.map((col) => (
                <div key={col.key} className="space-y-1">
                  <Label>{col.label}</Label>
                  <Input
                    name={col.key}
                    type={col.type === "date" ? "date" : col.type === "money" ? "number" : "text"}
                    defaultValue={client.customFields[col.key] ?? ""}
                    placeholder="Optional"
                  />
                </div>
              ))}
              <div className="space-y-1 md:col-span-2">
                <Label>Internal notes</Label>
                <Textarea name="notes" defaultValue={client.notes} rows={3} />
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Client tracking link</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Share this with the client. They only see marketplace setup progress.
          </p>
          <CopyLinkButton url={trackingUrl} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {platforms.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div className={`h-1.5 ${platformAccent[p.platform]}`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{PLATFORM_LABELS[p.platform]}</CardTitle>
              <Select
                defaultValue={p.status}
                onValueChange={(value) => {
                  refresh(async () => {
                    await updatePlatformStatus(p.id, value as PlatformStatus);
                    toast.success("Platform updated");
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PLATFORM_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-4">
              <CredentialForm
                accountId={p.id}
                sellerLogin={p.sellerLogin}
                credentialHint={p.credentialHint}
                pending={pending}
                start={refresh}
              />
              <ProgressRail steps={p.milestones} />
              {p.milestones.map((m) => (
                <div key={m.id} className="rounded-xl border bg-background/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{m.label}</p>
                    <Select
                      defaultValue={m.status}
                      onValueChange={(value) => {
                        refresh(async () => {
                          await updateMilestone(m.id, { status: value as MilestoneStatus });
                          toast.success("Step updated");
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MILESTONE_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    defaultValue={m.notes}
                    placeholder="GST mismatch, suppressed listing, brand approval…"
                    rows={2}
                    onBlur={(e) => {
                      const notes = e.target.value;
                      if (notes === m.notes) return;
                      refresh(async () => {
                        await updateMilestone(m.id, { notes });
                        toast.success("Notes saved");
                      });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockPanel clientId={client.id} inventory={inventory} pending={pending} start={refresh} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activity timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-2"
              action={(formData) => {
                refresh(async () => {
                  await addClientNote(
                    client.id,
                    String(formData.get("message") ?? ""),
                    String(formData.get("kind") ?? "note") as "note" | "health" | "ads",
                  );
                  toast.success("Logged");
                });
              }}
            >
              <div className="flex gap-2">
                <select
                  name="kind"
                  className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
                  defaultValue="note"
                >
                  <option value="note">Note</option>
                  <option value="health">Account health</option>
                  <option value="ads">Ads</option>
                </select>
                <Input name="message" placeholder="Health check, ads update, follow-up…" className="flex-1" />
                <Button type="submit" size="sm" disabled={pending}>
                  Log
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.map((row) => (
                  <div key={row.id} className="rounded-xl border bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {ACTIVITY_LABELS[row.kind as ActivityKind] || row.kind}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <RelativeTime iso={row.createdAt} />
                      </p>
                    </div>
                    <p className="text-sm">{row.message}</p>
                    <p className="text-xs text-muted-foreground">{row.actorName}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CredentialForm({
  accountId,
  sellerLogin,
  credentialHint,
  pending,
  start,
}: {
  accountId: string;
  sellerLogin: string;
  credentialHint: string;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const [revealed, setRevealed] = useState("");

  return (
    <form
      className="space-y-2 rounded-xl border bg-background/70 p-3"
      action={(formData) => {
        start(async () => {
          await saveSellerCredentials(accountId, {
            sellerLogin: String(formData.get("sellerLogin") ?? ""),
            password: String(formData.get("password") ?? ""),
          });
          toast.success("Credentials saved");
        });
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">Seller login</p>
      <Input name="sellerLogin" defaultValue={sellerLogin} placeholder="Seller ID / email" />
      <Input name="password" type="password" placeholder={credentialHint ? `Replace ${credentialHint}` : "Password"} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Save login
        </Button>
        {credentialHint ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              start(async () => {
                try {
                  const password = await revealSellerPassword(accountId);
                  setRevealed(password);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not reveal");
                }
              });
            }}
          >
            Reveal
          </Button>
        ) : null}
      </div>
      {revealed ? <p className="break-all text-xs font-mono">{revealed}</p> : null}
    </form>
  );
}

function StockPanel({
  clientId,
  inventory,
  pending,
  start,
}: {
  clientId: string;
  inventory: Workspace["inventory"];
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const [rows, setRows] = useState([{ name: "", quantity: 1, unitPrice: 0 }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Stock orders & sales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-3"
          action={(formData) => {
            start(async () => {
              const file = formData.get("proof");
              if (!(file instanceof File) || !file.size) {
                toast.error("Payment proof is required");
                return;
              }
              const upload = new FormData();
              upload.set("clientId", clientId);
              upload.set("file", file);
              const res = await fetch("/api/uploads", { method: "POST", body: upload });
              const body = (await res.json()) as { url?: string; error?: string };
              if (!res.ok || !body.url) {
                toast.error(body.error || "Upload failed");
                return;
              }
              await addStockOrder(clientId, {
                notes: String(formData.get("notes") ?? ""),
                proofUrl: body.url,
                items: rows.map((row) => ({
                  name: row.name,
                  quantity: Number(row.quantity),
                  unitPrice: Number(row.unitPrice),
                })),
              });
              setRows([{ name: "", quantity: 1, unitPrice: 0 }]);
              toast.success("Stock order saved");
            });
          }}
        >
          <p className="text-xs font-medium text-muted-foreground">New purchase</p>
          {rows.map((row, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Item"
                value={row.name}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], name: e.target.value };
                  setRows(next);
                }}
              />
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], quantity: Number(e.target.value) };
                  setRows(next);
                }}
              />
              <Input
                type="number"
                min={0}
                placeholder="Unit ₹"
                value={row.unitPrice || ""}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], unitPrice: Number(e.target.value) };
                  setRows(next);
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows([...rows, { name: "", quantity: 1, unitPrice: 0 }])}
          >
            Add item
          </Button>
          <Textarea name="notes" rows={2} placeholder="Recommendation / order notes" />
          <div className="space-y-1">
            <Label>Payment proof</Label>
            <Input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Record stock order"}
          </Button>
        </form>

        {inventory.openItems.length > 0 ? (
          <form
            className="space-y-2 rounded-xl border bg-background/70 p-3"
            action={(formData) => {
              start(async () => {
                await logClientSale(clientId, {
                  amount: Number(formData.get("amount") || 0),
                  units: Number(formData.get("units") || 0),
                  itemId: String(formData.get("itemId") || "") || undefined,
                  notes: String(formData.get("notes") ?? ""),
                });
                toast.success("Sale logged");
              });
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Log sale / deduct stock</p>
            <select name="itemId" className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
              <option value="">No SKU deduction</option>
              {inventory.openItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.remaining} left
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input name="units" type="number" min={0} placeholder="Units sold" />
              <Input name="amount" type="number" min={0} placeholder="Sale ₹" required />
            </div>
            <Input name="notes" placeholder="Optional note" />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Log sale
            </Button>
          </form>
        ) : null}

        <div className="space-y-2">
          {inventory.lots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock orders yet.</p>
          ) : (
            inventory.lots.map((lot) => (
              <div key={lot.id} className="rounded-xl border bg-background/70 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium tabular-nums">{formatInr(lot.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(lot.purchasedAt)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lot.items.map((item) => `${item.name} × ${item.quantity} (${item.remaining} left)`).join(" · ")}
                </p>
                {lot.notes ? <p className="text-xs">{lot.notes}</p> : null}
                {lot.proofUrl ? (
                  <a href={lot.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary">
                    View proof
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
