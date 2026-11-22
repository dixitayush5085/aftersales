"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, ROLES, type Role } from "@/types";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type Group = {
  id: string;
  name: string;
  smUserId: string;
};

function reportsToConfig(role: Role, staff: Staff[]) {
  if (role === "TEAM_MEMBER") {
    const options = staff.filter((s) => s.role === "MANAGER");
    return {
      show: true,
      label: "Reports to (Manager)",
      empty: "No managers yet — invite a Manager first",
      placeholder: "Select a manager",
      options,
    };
  }
  if (role === "MANAGER") {
    const options = staff.filter((s) => s.role === "SUPER_MANAGER");
    return {
      show: true,
      label: "Reports to (Super Manager)",
      empty: "No super managers yet — invite a Super Manager first",
      placeholder: "Select a super manager",
      options,
    };
  }
  return {
    show: false,
    label: "Reports to",
    empty: "",
    placeholder: "",
    options: [] as Staff[],
  };
}

export function InviteForm({
  actorRole,
  staff,
  onDone,
}: {
  actorRole: Role;
  staff: Staff[];
  groups?: Group[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const allowedRoles = ROLES.filter((r) => actorRole === "ADMIN" || r !== "ADMIN");
  const [role, setRole] = useState<Role>("TEAM_MEMBER");
  const [reportsTo, setReportsTo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const reports = useMemo(() => reportsToConfig(role, staff), [role, staff]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const form = e.currentTarget;
        const name = String(new FormData(form).get("name") ?? "");
        const email = String(new FormData(form).get("email") ?? "");
        if (reports.show && reports.options.length > 0 && !reportsTo) {
          setError(`Select who this ${ROLE_LABELS[role]} reports to`);
          return;
        }
        setPending(true);
        try {
          await inviteUser({
            name,
            email,
            role,
            reportsTo: reportsTo || undefined,
          });
          toast.success("Invite created. Copy the password link and send it.");
          form.reset();
          setReportsTo("");
          router.refresh();
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not invite");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value as Role);
            setReportsTo("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {reports.show ? (
        <div className="space-y-1.5">
          <Label>{reports.label}</Label>
          {reports.options.length === 0 ? (
            <p className="flex h-10 items-center text-sm text-muted-foreground">{reports.empty}</p>
          ) : (
            <Select value={reportsTo || undefined} onValueChange={setReportsTo}>
              <SelectTrigger>
                <SelectValue placeholder={reports.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {reports.options.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Reports to</Label>
          <p className="flex h-10 items-center text-sm text-muted-foreground">
            {role === "ADMIN" ? "Top of the hierarchy" : "Admin"}
          </p>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Inviting…" : "Send invite"}
      </Button>
    </form>
  );
}
