import type { MilestoneStatus, PlatformStatus } from "@/types";

/** Progress uses only platforms still in the plan. `na` milestones stay stored and are not counted. */
export function milestoneProgress(
  platforms: { status: PlatformStatus | string; milestones: { status: MilestoneStatus | string }[] }[],
) {
  const steps = platforms
    .filter((platform) => platform.status !== "na")
    .flatMap((platform) => platform.milestones);
  const completed = steps.filter((step) => step.status === "done").length;
  const total = steps.length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
