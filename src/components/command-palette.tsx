"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Inbox, LayoutDashboard, Search, Shield, Users } from "lucide-react";
import { searchClientsQuick } from "@/lib/actions/search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Permission, PermissionSet } from "@/types";

const pages: {
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
];

export function CommandPalette({ permissions }: { permissions: PermissionSet }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; mobile: string }[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("aftersales:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aftersales:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      start(async () => {
        setResults(await searchClientsQuick(q));
      });
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const nav = useMemo(
    () => pages.filter((p) => !p.permission || permissions[p.permission]),
    [permissions],
  );

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-3 p-3 sm:max-w-lg">
        <DialogTitle className="sr-only">Jump to</DialogTitle>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a page or client…"
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-80 space-y-3 overflow-auto p-1">
          <div>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pages
            </p>
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </button>
              );
            })}
          </div>
          {q.trim() ? (
            <div>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {pending ? "Searching…" : "Clients"}
              </p>
              {results.length === 0 && !pending ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">No matching clients</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => go(`/clients/${r.id}`)}
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left hover:bg-accent"
                  >
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.mobile}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
