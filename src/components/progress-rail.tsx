import { cn } from "@/lib/utils";
import type { MilestoneStatus } from "@/types";

export function ProgressRail({
  steps,
}: {
  steps: { id: string; label: string; status: MilestoneStatus }[];
}) {
  const done = steps.filter((s) => s.status === "done").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{done} of {steps.length} complete</span>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-poster-viridian transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                step.status === "done" && "bg-poster-viridian text-white",
                step.status === "blocked" && "bg-poster-vermillion text-white",
                step.status === "in_progress" && "bg-poster-cobalt text-white",
                step.status === "pending" && "bg-poster-chrome/20 text-poster-chrome",
              )}
            >
              {i + 1}
            </span>
            <span className="text-sm leading-5">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
