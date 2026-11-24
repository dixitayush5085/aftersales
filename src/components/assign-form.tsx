"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignPrimaryAm } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AssignForm({
  clientId,
  ams,
}: {
  clientId: string;
  ams: { id: string; name: string; email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [amId, setAmId] = useState(ams[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign team member</DialogTitle>
        </DialogHeader>
        {ams.length === 0 ? (
          <p className="text-sm text-muted-foreground">Invite a team member first from Team.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              start(async () => {
                try {
                  await assignPrimaryAm(clientId, amId);
                  toast.success("Assigned");
                  setOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not assign");
                }
              });
            }}
          >
            <Select value={amId} onValueChange={setAmId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {ams.map((am) => (
                  <SelectItem key={am.id} value={am.id}>
                    {am.name} ({am.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || !amId} className="w-full">
              {pending ? "Assigning…" : "Assign"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
