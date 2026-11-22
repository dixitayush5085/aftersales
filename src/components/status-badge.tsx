import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, PLATFORM_STATUS_LABELS, type Platform, type PlatformStatus } from "@/types";

const statusVariant: Record<PlatformStatus, "success" | "warning" | "info" | "muted"> = {
  done: "success",
  pending: "warning",
  open: "info",
  na: "muted",
};

export function PlatformPills({
  platforms,
}: {
  platforms: { platform: Platform; status: PlatformStatus }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {platforms.map((p) => (
        <Badge key={p.platform} variant={statusVariant[p.status]}>
          {PLATFORM_LABELS[p.platform]} · {PLATFORM_STATUS_LABELS[p.status]}
        </Badge>
      ))}
    </div>
  );
}
