"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { promoteUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { canGrantRole, nextRole, ROLE_LABELS, type Role } from "@/types";

export function PromoteButton({
  userId,
  name,
  role,
  actorRole,
}: {
  userId: string;
  name: string;
  role: Role;
  actorRole: Role;
}) {
  const target = nextRole(role);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!target || !canGrantRole(actorRole, target)) return null;

  const copy =
    target === "TEAM_LEAD"
      ? `${name} will become a Team Lead. Clients already assigned to them stay with them. They report to the Manager of their current Team Lead when that link exists.`
      : `${name} will become a Manager and sit under Admin. Team members who reported to them will need a new Team Lead.`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <ArrowUpRight className="h-4 w-4" />
          Promote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to {ROLE_LABELS[target]}</DialogTitle>
          <DialogDescription>{copy}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                try {
                  await promoteUser(userId);
                  toast.success(`Promoted to ${ROLE_LABELS[target]}`);
                  setOpen(false);
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not promote");
                }
              });
            }}
          >
            {pending ? "Promoting…" : `Promote to ${ROLE_LABELS[target]}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
