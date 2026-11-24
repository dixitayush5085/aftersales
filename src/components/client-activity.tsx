"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addClientNote } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type ActivityKind } from "@/types";
import type { listClientActivity } from "@/lib/queries/clients";

type Activity = Awaited<ReturnType<typeof listClientActivity>>;

const FILTERS: { id: "all" | ActivityKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "profile", label: "Profile" },
  { id: "status", label: "Status" },
  { id: "credential", label: "Credentials" },
  { id: "note", label: "Notes" },
  { id: "health", label: "Health" },
  { id: "ads", label: "Ads" },
  { id: "sale", label: "Sales" },
];

const KIND_LABELS: Record<string, string> = {
  note: "Note",
  status: "Status",
  credential: "Credentials",
  stock: "Stock",
  sale: "Sale",
  health: "Health",
  ads: "Ads",
  profile: "Profile",
};

export function ClientActivity({ clientId, activity }: { clientId: string; activity: Activity }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const rows = filter === "all" ? activity : activity.filter((row) => row.kind === filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          action={(formData) => {
            start(async () => {
              try {
                await addClientNote(
                  clientId,
                  String(formData.get("message") ?? ""),
                  String(formData.get("kind") ?? "note") as "note" | "health" | "ads",
                );
                router.refresh();
                toast.success("Logged");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not log the note");
              }
            });
          }}
        >
          <select
            name="kind"
            className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
            defaultValue="note"
          >
            <option value="note">Note</option>
            <option value="health">Account health</option>
            <option value="ads">Ads</option>
          </select>
          <Input name="message" placeholder="Health check, ads update, follow-up…" className="min-w-48 flex-1" />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Log"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                filter === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this view.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-xl border bg-background/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {KIND_LABELS[row.kind] || row.kind}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <RelativeTime iso={row.createdAt} />
                  </p>
                </div>
                <p className="text-sm">{row.message}</p>
                <p className="text-xs text-muted-foreground">
                  {row.actorName} · {ROLE_LABELS[row.actorRole]}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
