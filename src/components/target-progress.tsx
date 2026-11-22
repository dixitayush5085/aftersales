"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMyMonthlyTarget } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInr } from "@/lib/format";

export function TargetProgress({
  amount,
  achieved,
  monthLabel,
}: {
  amount: number;
  achieved: number;
  monthLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pct = amount > 0 ? Math.min(100, Math.round((achieved / amount) * 100)) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-poster-viridian" />
      <CardHeader>
        <CardTitle className="text-sm">Monthly target · {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{formatInr(achieved)}</p>
            <p className="text-xs text-muted-foreground">
              of {amount > 0 ? formatInr(amount) : "no target set"}
            </p>
          </div>
          <p className="text-sm font-medium tabular-nums">{pct}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-poster-viridian transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          action={(formData) => {
            start(async () => {
              await setMyMonthlyTarget(Number(formData.get("amount") || 0));
              router.refresh();
              toast.success("Target saved");
            });
          }}
        >
          <div className="space-y-1">
            <Label>Set this month (₹)</Label>
            <Input name="amount" type="number" min={0} defaultValue={amount || ""} placeholder="1000000" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save target"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
