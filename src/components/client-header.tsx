import { CopyLinkButton } from "@/components/copy-link-button";
import { Badge } from "@/components/ui/badge";
import { PLAN_OPTIONS } from "@/types";
import type { getClientShell } from "@/lib/queries/clients";

type Shell = NonNullable<Awaited<ReturnType<typeof getClientShell>>>;

function planLabel(planType: string) {
  const match = PLAN_OPTIONS.find((option) => option.value === planType);
  if (match) return match.label;
  if (!planType || planType === "all") return "All platforms";
  return planType;
}

export function ClientHeader({ shell, trackingUrl }: { shell: Shell; trackingUrl: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-poster-vermillion">
          Client
        </p>
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {shell.companyName || shell.name || "Client"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {planLabel(shell.planType)} · {shell.progress.completed} of {shell.progress.total} steps
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-28">
          <p className="text-right text-2xl font-semibold tabular-nums">{shell.progress.percent}%</p>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-poster-viridian"
              style={{ width: `${shell.progress.percent}%` }}
            />
          </div>
        </div>
        <Badge variant={shell.lifecycleStatus === "active" ? "success" : "destructive"}>
          {shell.lifecycleStatus === "active" ? "Active" : "Rolled back"}
        </Badge>
        <CopyLinkButton url={trackingUrl} label="Copy tracking link" />
      </div>
    </div>
  );
}
