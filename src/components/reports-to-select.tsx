"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setReportsTo } from "@/lib/actions/users";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReportsToSelect({
  userId,
  value,
  options,
  placeholder,
}: {
  userId: string;
  value: string;
  options: { id: string; name: string }[];
  placeholder: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (options.length === 0) return null;

  return (
    <Select
      value={value || undefined}
      disabled={pending}
      onValueChange={(next) => {
        start(async () => {
          try {
            await setReportsTo(userId, next);
            toast.success("Reporting line updated");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not update");
          }
        });
      }}
    >
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
