"use client";

import { useActionState } from "react";
import { useParams } from "next/navigation";
import { acceptInviteAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const bound = acceptInviteAction.bind(null, token);
  const [state, action, pending] = useActionState(bound, {});

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sidebar p-4">
      <div className="pointer-events-none absolute -left-10 top-10 h-72 w-72 rounded-full bg-poster-vermillion/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-poster-cobalt/30 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 shadow-xl page-enter">
        <BrandMark />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-poster-vermillion">
          Ziloty After Sales
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this link to create a password the first time, or to reset it later.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} />
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
