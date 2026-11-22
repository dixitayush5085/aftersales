"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import {
  PLATFORM_LABELS,
  PUBLIC_MILESTONE_LABELS,
  type MilestoneStatus,
  type Platform,
  type PlatformStatus,
} from "@/types";
import { cn } from "@/lib/utils";

const platformAccent: Record<Platform, string> = {
  amazon: "bg-poster-chrome",
  flipkart: "bg-poster-cobalt",
  meesho: "bg-poster-violet",
};

type TrackingData = {
  name: string;
  companyName: string;
  platforms: {
    id: string;
    platform: Platform;
    status: PlatformStatus;
    milestones: { id: string; label: string; status: MilestoneStatus; notes: string }[];
  }[];
};

export function PublicTracking({ data }: { data: TrackingData }) {
  const steps = data.platforms.flatMap((p) => p.milestones);
  const done = steps.filter((s) => s.status === "done").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const [bar, setBar] = useState(0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setBar(pct));
    return () => window.cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-poster-vermillion/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-poster-cobalt/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-poster-chrome/15 blur-3xl" />

      <div className="relative mx-auto max-w-4xl space-y-10 page-enter">
        <header className="flex flex-col items-center text-center">
          <BrandMark size="lg" />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-poster-vermillion">
            Ziloty
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {data.companyName || data.name}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Your marketplace accounts are being set up. This page updates as each step is completed.
          </p>
        </header>

        <section className="rounded-3xl border bg-card p-6 shadow-[0_1px_0_rgba(20,26,56,0.04)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Overall setup</p>
              <p className="text-xs text-muted-foreground">
                {done} of {steps.length} steps complete
              </p>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{pct}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-poster-viridian transition-[width] duration-700 ease-out"
              style={{ width: `${bar}%` }}
            />
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {data.platforms.map((p) => {
            const localDone = p.milestones.filter((m) => m.status === "done").length;
            return (
              <article key={p.id} className="overflow-hidden rounded-3xl border bg-card">
                <div className={`h-1.5 ${platformAccent[p.platform]}`} />
                <div className="space-y-4 p-5">
                  <div>
                    <h2 className="text-lg font-semibold">{PLATFORM_LABELS[p.platform]}</h2>
                    <p className="text-xs text-muted-foreground">
                      {localDone}/{p.milestones.length} complete
                    </p>
                  </div>
                  <ol className="space-y-3">
                    {p.milestones.map((m, idx) => (
                      <li key={m.id} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                            m.status === "done" && "bg-poster-viridian text-white",
                            m.status === "blocked" && "bg-poster-vermillion text-white",
                            m.status === "pending" && "bg-poster-chrome/15 text-poster-chrome",
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{m.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {PUBLIC_MILESTONE_LABELS[m.status]}
                          </p>
                          {m.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">Update: {m.notes}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">Powered by Ziloty After Sales</p>
      </div>
    </div>
  );
}
