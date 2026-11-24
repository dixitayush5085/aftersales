"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  revealSellerPassword,
  saveCatalogNotes,
  saveSellerCredentials,
  updateClientExtras,
  updateMilestone,
  updatePlatformStatus,
} from "@/lib/actions/clients";
import { ProgressRail } from "@/components/progress-rail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatInr, gstLabel } from "@/lib/format";
import {
  GST_STATUSES,
  PLAN_OPTIONS,
  PLATFORM_LABELS,
  PLATFORM_STATUSES,
  PLATFORM_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  type GstStatus,
  type MilestoneStatus,
  type Platform,
  type PlatformStatus,
} from "@/types";
import type { getClientOverview } from "@/lib/queries/clients";

type Workspace = NonNullable<Awaited<ReturnType<typeof getClientOverview>>>;

const platformAccent: Record<Platform, string> = {
  amazon: "bg-poster-chrome",
  flipkart: "bg-poster-cobalt",
  meesho: "bg-poster-violet",
};

export function ClientOverview({ data }: { data: Workspace }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = (fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  const { client, platforms, visibleKeys, customColumns } = data;
  const see = (key: string) => visibleKeys.includes(key);

  return (
    <div className="space-y-6">
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
            {see("saleDate") ? <p>Sale date: {formatDate(client.saleDate)}</p> : null}
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
                    gstStatus: String(formData.get("gstStatus") ?? "") as GstStatus,
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
                <Label>GST status</Label>
                <select
                  name="gstStatus"
                  defaultValue={client.gstStatus}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                >
                  {GST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {gstLabel(status)}
                    </option>
                  ))}
                </select>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {platforms.map((p) => (
          <Card key={p.id} className={`overflow-hidden ${p.status === "na" ? "opacity-70" : ""}`}>
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
              {p.status === "na" ? (
                <p className="text-xs text-muted-foreground">
                  Not needed for this plan. Milestones and seller login stay saved, and this platform is left out of the progress percentage.
                </p>
              ) : null}
              <CredentialForm
                accountId={p.id}
                sellerLogin={p.sellerLogin}
                credentialHint={p.credentialHint}
                pending={pending}
                start={refresh}
              />
              <Textarea
                defaultValue={p.catalogNotes}
                placeholder="Catalog / SEO notes"
                rows={2}
                onBlur={(e) => {
                  const notes = e.target.value;
                  if (notes === p.catalogNotes) return;
                  refresh(async () => {
                    await saveCatalogNotes(p.id, notes);
                    toast.success("Catalog notes saved");
                  });
                }}
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
