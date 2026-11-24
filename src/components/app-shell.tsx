"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, LogOut, Menu, Users, FolderKanban, Search, Shield, X } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand-mark";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Permission, type PermissionSet, type Role } from "@/types";
import { cn } from "@/lib/utils";

const links: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Unassigned", icon: Inbox, permission: "assignClients" },
  { href: "/clients", label: "Clients", icon: FolderKanban },
  { href: "/admin/users", label: "Team", icon: Users, permission: "accessTeam" },
  { href: "/admin/access", label: "Access", icon: Shield, permission: "manageAccess" },
  // Named groups remain in the database from the old Super Manager pods.
  // Reporting now follows Manager → Team Lead, so the Groups screen stays hidden.
  // { href: "/admin/groups", label: "Groups", icon: UserPlus, permission: "manageAccess" },
];

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Unassigned",
  "/clients": "Clients",
  "/admin/users": "Team",
  "/admin/access": "Access",
  "/admin/groups": "Groups",
};

export function AppShell({
  user,
  permissions,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: Role };
  permissions: PermissionSet;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = links.filter((l) => !l.permission || permissions[l.permission]);
  const title =
    titles[pathname] ||
    (pathname.startsWith("/clients/") ? "Client" : "After Sales");

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={() => {
              if (mobileOpen) setMobileOpen(false);
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground",
            )}
          >
            <span
              className={cn(
                "h-4 w-0.5 rounded-full transition-colors",
                active ? "bg-poster-vermillion" : "bg-transparent",
              )}
            />
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-full min-h-screen bg-background">
      <CommandPalette permissions={permissions} />
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandMark />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-muted">
              Ziloty
            </p>
            <h1 className="text-base font-semibold tracking-tight">After Sales</h1>
          </div>
        </div>
        {navList}
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-sidebar-muted">{ROLE_LABELS[user.role]}</p>
          <form action={logoutAction} className="mt-3">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground fade-in">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2">
                <BrandMark size="sm" />
                <span className="font-semibold">After Sales</span>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-card/85 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold tracking-tight">{title}</p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("aftersales:command"))}
            className="hidden items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground md:flex"
          >
            <Search className="h-3.5 w-3.5" />
            Jump to
            <kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
