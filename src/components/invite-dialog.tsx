"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { InviteForm } from "@/components/invite-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Role } from "@/types";

export function InviteDialog({
  actorRole,
  staff,
}: {
  actorRole: Role;
  staff: { id: string; name: string; email: string; role: Role }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>
            They’ll get a permanent password link you can copy from their row.
          </DialogDescription>
        </DialogHeader>
        <InviteForm actorRole={actorRole} staff={staff} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
