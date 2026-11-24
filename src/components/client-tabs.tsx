"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "sales", label: "Sales" },
  { slug: "activity", label: "Activity" },
  { slug: "inventory", label: "Inventory" },
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const href = `/clients/${clientId}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.slug}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              active
                ? "border-poster-vermillion text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
