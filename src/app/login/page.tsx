"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-sidebar" />
      <div className="pointer-events-none absolute -left-10 top-10 h-72 w-72 rounded-full bg-poster-vermillion/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-poster-chrome/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-poster-violet/20 blur-3xl" />

      <div className="relative hidden w-[46%] flex-col justify-between p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted">
              Ziloty
            </p>
            <p className="text-lg font-semibold">After Sales</p>
          </div>
        </div>
        <div className="max-w-sm space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Keep converted clients moving.</h1>
          <p className="text-sm text-sidebar-muted">
            Assignment, marketplace onboarding, and live client tracking.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">aftersales.ziloty.in</p>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-xl page-enter">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-poster-vermillion">
                Ziloty
              </p>
              <p className="font-semibold">After Sales</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the email you were invited with.
          </p>
          <form action={action} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
